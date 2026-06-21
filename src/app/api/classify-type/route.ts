import { NextRequest, NextResponse } from 'next/server'
import { classifyContentType } from '@/lib/agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { brief } = await req.json() as { brief?: string }
  if (!brief?.trim()) return NextResponse.json({ error: 'Missing brief' }, { status: 400 })

  try {
    const contentType = await classifyContentType(brief.trim())
    return NextResponse.json({ contentType })
  } catch {
    return NextResponse.json({ error: 'Classification failed' }, { status: 502 })
  }
}
