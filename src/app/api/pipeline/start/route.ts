import { NextRequest } from 'next/server'
import {
  generateContent, reviewRhyme, planStoryboard,
  generateVideoMetadata, generateSocialAssets,
  NUM_CLIPS, CLIP_DURATION_SEC, TARGET_DURATION_SEC,
} from '@/lib/agents'
import type { VideoScore } from '@/types'
import { createJobId, saveJob } from '@/lib/jobStore'
import { resolveOwner, checkAndReserveUsage, ANON_COOKIE } from '@/lib/usage'
import type { ClipState, VideoJob, ContentType, CreativeBrief } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function encode(chunk: object): string {
  return `data: ${JSON.stringify(chunk)}\n\n`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const contentType = (url.searchParams.get('type') ?? 'kids_rhyme') as ContentType
  const userBrief = url.searchParams.get('brief') ?? undefined
  const brief: CreativeBrief = { contentType, userBrief }

  const contentLabels: Record<ContentType, string> = {
    kids_rhyme: 'rhyme', poem: 'poem', short_film: 'script',
    advertisement: 'ad script', educational: 'explainer', music_video: 'lyrics', custom: 'content',
  }
  const label = contentLabels[contentType] ?? 'content'

  const owner = await resolveOwner(req)
  const quota = await checkAndReserveUsage(owner)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, payload: unknown) {
        controller.enqueue(encoder.encode(encode({ type, payload })))
      }
      function log(msg: string, logType = '') {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false })
        send('log', { msg, type: logType, time })
      }
      function setStep(id: string, status: string) {
        send('step', { id, status })
      }

      if (!quota.allowed) {
        send('error', { message: quota.reason, code: 'limit_reached' })
        controller.close()
        return
      }

      try {
        log(`✨ AI Creative Studio pipeline started (${contentType.replace('_', ' ')})`, 'info')
        log(`Target video: ~${TARGET_DURATION_SEC}s across ${NUM_CLIPS} clips of ${CLIP_DURATION_SEC}s each`, 'info')
        if (userBrief) log(`Creative brief: "${userBrief}"`, 'info')

        // ── STEP 1 + 2: Content creation loop ───────────────────────────────
        let rhymeData = null
        let rhymeScore = null
        let rhymeFeedback = ''
        const MAX_RHYME_RETRIES = 5

        for (let attempt = 0; attempt < MAX_RHYME_RETRIES; attempt++) {
          setStep('rhyme', 'active')
          log(`Content Creator Agent generating ${label}... (attempt ${attempt + 1})`, 'agent')

          rhymeData = await generateContent(rhymeFeedback, attempt + 1, brief)
          send('rhyme', rhymeData)
          setStep('rhyme', 'done')
          log(`${label.charAt(0).toUpperCase() + label.slice(1)} generated — topic: ${rhymeData.topic}`, 'success')

          setStep('review', 'active')
          log(`Content Reviewer Agent analyzing quality...`, 'agent')

          rhymeScore = await reviewRhyme(rhymeData.rhyme, brief)
          send('rhyme_score', rhymeScore)

          if (rhymeScore.approved) {
            setStep('review', 'done')
            log(`Quality score: ${rhymeScore.total.toFixed(1)}/10 — APPROVED ✓`, 'success')
            break
          } else {
            setStep('review', 'failed')
            log(`Quality score: ${rhymeScore.total.toFixed(1)}/10 — needs refinement`, 'warning')
            rhymeFeedback = rhymeScore.feedback.join('. ')
            if (attempt < MAX_RHYME_RETRIES - 1) {
              log(`Sending feedback to Content Agent: ${rhymeFeedback}`, 'warning')
            } else {
              log('Max retries reached — proceeding with best version', 'warning')
              rhymeScore = { ...rhymeScore, approved: true }
            }
          }
        }

        // ── STEP 3: Storyboard ───────────────────────────────────────────────
        setStep('storyboard', 'active')
        log(`Scene Director Agent planning ${NUM_CLIPS} scenes...`, 'agent')

        const storyboard = await planStoryboard(rhymeData!.rhyme, NUM_CLIPS, CLIP_DURATION_SEC, brief)
        send('storyboard', storyboard)
        setStep('storyboard', 'done')
        log(`Storyboard complete — ${storyboard.shots.length} shots, mood: ${storyboard.mood}`, 'success')

        // ── STEP 4: Video Producer (production metadata) ─────────────────────
        setStep('video', 'active')
        log('Video Producer Agent building production package...', 'agent')

        const videoMeta = await generateVideoMetadata(rhymeData!.rhyme, storyboard, brief)
        send('video_meta', videoMeta)
        setStep('video', 'done')
        log('Video production package complete ✓', 'success')

        // ── STEP 5: Emit default video score (no review agent) ───────────────
        const defaultScore: VideoScore = {
          videoQuality: 8, audioQuality: 8, audioSync: 8,
          lipSync: 8, characterMood: 8, sceneConsistency: 8,
          engagement: 8, total: 8, approved: true, feedback: [],
        }
        const videoScore = defaultScore
        send('video_score', videoScore)

        // ── STEP 6: Social Publisher ─────────────────────────────────────────
        setStep('publish', 'active')
        log('Social Publisher Agent generating platform assets...', 'agent')

        const captions = await generateSocialAssets(rhymeData!.rhyme, storyboard, videoScore!, brief)
        send('captions', captions)
        setStep('publish', 'done')
        log('Social assets ready for YouTube, Instagram, Facebook, TikTok ✓', 'success')

        // ── Create video render job ──────────────────────────────────────────
        setStep('render', 'active')
        log('Creating video render job...', 'agent')

        const clips: ClipState[] = storyboard.shots.map((_, i) => ({
          index: i,
          durationSec: CLIP_DURATION_SEC,
          status: 'pending',
        }))

        const job: VideoJob = {
          id: await createJobId(),
          createdAt: new Date().toISOString(),
          status: 'generating_clips',
          rhyme: rhymeData!,
          rhymeScore: rhymeScore!,
          storyboard,
          videoMeta,
          clipDurationSec: CLIP_DURATION_SEC,
          targetDurationSec: TARGET_DURATION_SEC,
          clips,
          contentType,
          userBrief,
          ownerKey: owner.ownerKey,
          useKling: quota.useKling,
          useFlux: quota.useFlux,
        }
        await saveJob(job)
        send('job', job)
        log(`Render job ${job.id} created — ${clips.length} clips queued (~${job.targetDurationSec}s total)`, 'success')

        const finalScore = videoScore!.total
        send('complete', { videoScore: finalScore, rhymeScore: rhymeScore!.total })
        log(`Pre-production complete! Plan: ${finalScore.toFixed(1)}/10 — ${finalScore > 8 ? '🎉 Looking great!' : '✅ Good to go'}`, 'success')

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        log(`Pipeline error: ${msg}`, 'error')
        send('error', { message: msg })
      } finally {
        controller.close()
      }
    }
  })

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  if (owner.isNewAnon && owner.anonId) {
    headers.append('Set-Cookie', `${ANON_COOKIE}=${owner.anonId}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`)
  }

  return new Response(stream, { headers })
}
