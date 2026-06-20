import { put } from '@vercel/blob'
import { createClient } from '@supabase/supabase-js'
import type { VideoJob } from '@/types'

const blobOpts = { access: 'public' as const, addRandomSuffix: false, allowOverwrite: true }

// Job *state* lives in Postgres (strongly consistent) rather than Vercel Blob —
// Blob's list() API has eventual-consistency lag on overwrites, which caused the
// stitch route to intermittently report "Job not found" right after the last
// clip finished. Blob remains the right place for the actual binary files below.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function createJobId(): Promise<string> {
  return crypto.randomUUID()
}

export async function saveJob(job: VideoJob): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('video_jobs')
    .upsert({ id: job.id, data: job, owner_key: job.ownerKey, updated_at: new Date().toISOString() })
  if (error) throw new Error(`saveJob failed: ${error.message}`)
}

export async function loadJob(id: string): Promise<VideoJob | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('video_jobs')
    .select('data')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data.data as VideoJob
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

export async function saveNarrationAudio(jobId: string, bytes: Buffer): Promise<string> {
  const { url } = await put(`jobs/${jobId}/narration.wav`, bytes, { ...blobOpts, contentType: 'audio/wav' })
  return url
}
