import { NextRequest, NextResponse } from 'next/server'
import { generateVeoClip } from '@/lib/agents'
import { loadJob, saveJob, saveClip } from '@/lib/jobStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Generates (or resumes) a single clip for a job. Designed to be called
// repeatedly by the client, one clip at a time, until the whole job's
// clips array is all 'done' (or 'error').
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
    const result = await generateVeoClip(clip.prompt, {
      durationSeconds: clip.durationSec,
      operationName: clip.operationName,
      maxWaitMs: 270000,
    })

    if (result.status === 'done' && result.bytes) {
      const url = await saveClip(job.id, clip.index, result.bytes, result.mimeType ?? 'video/mp4')
      clip.status = 'done'
      clip.url = url
      delete clip.operationName
    } else if (result.status === 'pending') {
      clip.status = 'generating'
      clip.operationName = result.operationName
    } else {
      clip.status = 'error'
      clip.error = result.error ?? 'Unknown Veo error'
    }
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
