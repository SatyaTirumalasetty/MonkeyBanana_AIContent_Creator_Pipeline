import { put, list } from '@vercel/blob'
import type { VideoJob } from '@/types'

const blobOpts = { access: 'public' as const, addRandomSuffix: false, allowOverwrite: true }

export async function createJobId(): Promise<string> {
  return crypto.randomUUID()
}

export async function saveJob(job: VideoJob): Promise<void> {
  await put(`jobs/${job.id}/state.json`, JSON.stringify(job), {
    ...blobOpts,
    contentType: 'application/json',
  })
}

export async function loadJob(id: string): Promise<VideoJob | null> {
  // Vercel Blob list() uses S3 which can have eventual-consistency lag after a
  // fresh put(). Retry up to 4 times with backoff so the stitch route doesn't
  // fail immediately after the last clip is saved.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { blobs } = await list({ prefix: `jobs/${id}/state.json`, limit: 1 })
    if (blobs.length) {
      const res = await fetch(blobs[0].url, { cache: 'no-store' })
      if (res.ok) return res.json() as Promise<VideoJob>
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 750 * (attempt + 1)))
  }
  return null
}

export async function saveClip(jobId: string, clipIndex: number, bytes: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'bin'
  const pathname = `jobs/${jobId}/clip-${String(clipIndex).padStart(3, '0')}.${ext}`
  const { url } = await put(pathname, bytes, { ...blobOpts, contentType: mimeType })
  return url
}

export async function saveReferenceImage(jobId: string, bytes: Buffer): Promise<string> {
  const { url } = await put(`jobs/${jobId}/ref-frame.png`, bytes, { ...blobOpts, contentType: 'image/png' })
  return url
}

export async function saveFinalVideo(jobId: string, bytes: Buffer): Promise<string> {
  const { url } = await put(`jobs/${jobId}/final.mp4`, bytes, { ...blobOpts, contentType: 'video/mp4' })
  return url
}
