import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import { loadJob, saveJob, saveFinalVideo } from '@/lib/jobStore'

ffmpeg.setFfmpegPath(ffmpegPath.path)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function stitchClips(inputPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
    inputPaths.forEach(p => command.input(p))
    const filter = inputPaths.map((_, i) => `[${i}:v]`).join('') + `concat=n=${inputPaths.length}:v=1:a=0[outv]`
    command
      .complexFilter(filter, 'outv')
      .videoCodec('libx264')
      .outputOptions(['-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

export async function POST(req: NextRequest) {
  const { jobId } = await req.json() as { jobId: string }

  const job = await loadJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  if (job.finalVideoUrl) return NextResponse.json({ job })

  if (!job.clips.every(c => c.status === 'done' && c.url)) {
    return NextResponse.json({ error: 'Not all clips are ready' }, { status: 409 })
  }

  job.status = 'stitching'
  await saveJob(job)

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `kids-studio-${job.id}-`))
  try {
    const inputPaths: string[] = []
    for (const clip of job.clips) {
      const res = await fetch(clip.url!)
      if (!res.ok) throw new Error(`Failed to download clip ${clip.index}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const p = path.join(workDir, `clip-${String(clip.index).padStart(3, '0')}.mp4`)
      await fs.writeFile(p, buf)
      inputPaths.push(p)
    }

    const outputPath = path.join(workDir, 'final.mp4')
    await stitchClips(inputPaths, outputPath)

    const finalBytes = await fs.readFile(outputPath)
    const url = await saveFinalVideo(job.id, finalBytes)

    job.status = 'complete'
    job.finalVideoUrl = url
    job.error = undefined
    await saveJob(job)

    return NextResponse.json({ job })
  } catch (err) {
    job.status = 'error'
    job.error = err instanceof Error ? err.message : 'Stitch failed'
    await saveJob(job)
    return NextResponse.json({ error: job.error }, { status: 500 })
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}
