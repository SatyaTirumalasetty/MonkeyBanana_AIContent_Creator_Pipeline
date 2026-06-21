import { NextRequest, NextResponse } from 'next/server'
import { listJobsByOwner } from '@/lib/jobStore'
import { resolveOwner } from '@/lib/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const owner = await resolveOwner(req)
  const jobs = await listJobsByOwner(owner.ownerKey)

  const summaries = jobs.map((job) => ({
    id: job.id,
    createdAt: job.createdAt,
    status: job.status,
    contentType: job.contentType,
    topic: job.rhyme?.topic,
    thumbnailUrl: job.referenceImageUrl,
    finalVideoUrl: job.finalVideoUrl,
    error: job.error,
  }))

  return NextResponse.json({ jobs: summaries })
}
