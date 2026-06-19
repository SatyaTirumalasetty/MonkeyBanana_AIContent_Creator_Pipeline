import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import { loadJob, saveJob, saveClip, saveReferenceImage } from '@/lib/jobStore'
import type { StoryboardShot, Storyboard, ContentType } from '@/types'

ffmpeg.setFfmpegPath(ffmpegPath.path)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CLIP_DURATION = '5' as const
const ASPECT_RATIO = '9:16' as const
const NEGATIVE_PROMPT = 'adult content, violence, disturbing imagery, watermarks, text overlays'

const KLING_STYLE: Record<ContentType, string> = {
  kids_rhyme:    'vibrant colors, smooth motion, toddler friendly, anime cartoon style',
  poem:          'cinematic, soft atmospheric lighting, artistic composition, 4K quality',
  short_film:    'cinematic drama, realistic, subtle film grain, professional lighting',
  advertisement: 'commercial, clean modern aesthetic, high production value, lifestyle',
  educational:   'clean explainer style, bright and clear, infographic elements',
  music_video:   'dynamic, energetic, stylized vibrant lighting, music video aesthetic',
  custom:        'professional, cinematic, high quality, visually compelling',
}

const FLUX_STYLE: Record<ContentType, string> = {
  kids_rhyme:    'vibrant colors, cute cartoon illustration, bright cheerful colors, toddler friendly',
  poem:          'cinematic fine art photography, soft atmospheric lighting, artistic composition',
  short_film:    'cinematic drama, realistic movie still, professional lighting, film photography',
  advertisement: 'commercial photography, clean modern aesthetic, high production value, lifestyle',
  educational:   'clean infographic illustration, bright and clear, educational graphic design',
  music_video:   'dynamic editorial photography, energetic, stylized vibrant lighting',
  custom:        'professional photography, high quality, visually compelling, detailed',
}

function buildKlingPrompt(shot: StoryboardShot, storyboard: Storyboard, contentType?: ContentType): string {
  const mood = storyboard.mood || 'cinematic'
  const bgStyle = storyboard.backgroundStyle || 'colorful'
  const style = KLING_STYLE[contentType ?? 'kids_rhyme']
  return `${shot.description}, ${shot.camera}. ${mood} atmosphere, ${bgStyle}, ${style}`
}

async function extractLastFrame(videoBuffer: Buffer): Promise<Buffer> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kids-ref-'))
  const inputPath = path.join(workDir, 'clip.mp4')
  const outputPath = path.join(workDir, 'frame.png')
  try {
    await fs.writeFile(inputPath, videoBuffer)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(4.0)
        .outputOptions(['-vframes', '1'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })
    return await fs.readFile(outputPath)
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

// Renders a single AI video clip for a job.
// When FAL_KEY is set: uses Kling AI via fal.ai (scene 0 = text-to-video;
// scenes 1+ = image-to-video with scene 0's last frame as character reference).
// When FAL_KEY is absent: falls back to a canvas-drawn still frame animated
// with a Ken Burns zoom via ffmpeg — no external API needed.
export async function POST(req: NextRequest) {
  const { jobId, clipIndex } = await req.json() as { jobId: string; clipIndex: number }

  const job = await loadJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const clip = job.clips[clipIndex]
  if (!clip) return NextResponse.json({ error: 'Clip index out of range' }, { status: 400 })

  if (clip.status === 'done') {
    return NextResponse.json({ job, clip })
  }

  clip.status = 'generating'
  await saveJob(job)

  try {
    const shot = job.storyboard.shots[clipIndex]
    let videoBuffer: Buffer | undefined

    if (process.env.FAL_KEY) {
      // ── Kling AI path ──────────────────────────────────────────────────────
      try {
        fal.config({ credentials: process.env.FAL_KEY })
        const prompt = buildKlingPrompt(shot, job.storyboard, job.contentType)

        if (clipIndex === 0 || !job.referenceImageUrl) {
          // Scene 0: text-to-video establishes the visual style and characters
          const result = await fal.run('fal-ai/kling-video/v1.6/standard/text-to-video', {
            input: {
              prompt,
              negative_prompt: NEGATIVE_PROMPT,
              duration: CLIP_DURATION,
              aspect_ratio: ASPECT_RATIO,
            },
          }) as unknown as { video: { url: string } }

          const res = await fetch(result.video.url)
          if (!res.ok) throw new Error(`Failed to download Kling clip 0: ${res.status}`)
          videoBuffer = Buffer.from(await res.arrayBuffer())

          // Extract last frame and save as reference for all subsequent scenes
          const frameBuffer = await extractLastFrame(videoBuffer)
          job.referenceImageUrl = await saveReferenceImage(job.id, frameBuffer)
        } else {
          // Scenes 1+: image-to-video locks character appearance via reference frame
          const result = await fal.run('fal-ai/kling-video/v1.6/pro/image-to-video', {
            input: {
              prompt,
              image_url: job.referenceImageUrl,
              negative_prompt: NEGATIVE_PROMPT,
              duration: CLIP_DURATION,
              aspect_ratio: ASPECT_RATIO,
            },
          }) as unknown as { video: { url: string } }

          const res = await fetch(result.video.url)
          if (!res.ok) throw new Error(`Failed to download Kling clip ${clipIndex}: ${res.status}`)
          videoBuffer = Buffer.from(await res.arrayBuffer())
        }
      } catch (falErr) {
        const msg = falErr instanceof Error ? falErr.message : String(falErr)
        if (/forbidden|403/i.test(msg)) {
          // Kling needs credits — try Flux Schnell image tier (~$0.003/image)
          console.warn(`[clip/${clipIndex}] Kling AI 403 Forbidden — trying Flux Schnell image tier`)
          try {
            const fluxPrompt = `${shot.description}, ${shot.camera}. ${FLUX_STYLE[job.contentType ?? 'custom']}`
            const fluxResult = await fal.run('fal-ai/flux/schnell', {
              input: { prompt: fluxPrompt, image_size: 'portrait_9_16', num_images: 1 },
            }) as unknown as { images: Array<{ url: string }> }
            const imgRes = await fetch(fluxResult.images[0].url)
            if (!imgRes.ok) throw new Error(`Flux download failed: ${imgRes.status}`)
            const imgBuf = Buffer.from(await imgRes.arrayBuffer())
            const [{ renderFluxFrame, captionForShot }, { renderSlideClip }] = await Promise.all([
              import('@/lib/renderShot'),
              import('@/lib/renderClip'),
            ])
            const caption = captionForShot(shot, job.videoMeta)
            const frameBuffer = await renderFluxFrame(imgBuf, caption)
            videoBuffer = await renderSlideClip(frameBuffer, clip.durationSec, clipIndex % 2 === 0)
          } catch (fluxErr) {
            console.warn(`[clip/${clipIndex}] Flux Schnell failed — falling back to canvas`, fluxErr)
            // videoBuffer stays undefined → canvas fallback below
          }
        } else {
          throw falErr
        }
      }
    }

    if (!videoBuffer) {
      // ── Canvas slideshow fallback (no FAL_KEY, or all AI tiers failed) ──────
      // Draws a styled still frame with @napi-rs/canvas and animates it with
      // a Ken Burns zoom using ffmpeg — fully self-contained, no external APIs.
      const [{ renderShotFrame, captionForShot }, { renderSlideClip }] = await Promise.all([
        import('@/lib/renderShot'),
        import('@/lib/renderClip'),
      ])
      const caption = captionForShot(shot, job.videoMeta)
      const frameBuffer = renderShotFrame(shot, caption, clipIndex)
      videoBuffer = await renderSlideClip(frameBuffer, clip.durationSec, clipIndex % 2 === 0)
    }

    const url = await saveClip(job.id, clip.index, videoBuffer, 'video/mp4')
    clip.status = 'done'
    clip.url = url
  } catch (err) {
    clip.status = 'error'
    clip.error = err instanceof Error ? err.message : 'Unknown error'
  }

  if (job.clips.every(c => c.status === 'done')) {
    job.status = 'stitching'
  }
  await saveJob(job)

  return NextResponse.json({ job, clip })
}
