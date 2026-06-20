import { NextRequest, NextResponse } from 'next/server'
import { loadJob } from '@/lib/jobStore'
import { resolveOwner } from '@/lib/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const job = await loadJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const owner = await resolveOwner(req)
  if (job.ownerKey !== owner.ownerKey) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  return NextResponse.json({ job })
}
