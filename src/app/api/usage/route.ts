import { NextRequest, NextResponse } from 'next/server'
import { resolveOwner, getUsageSnapshot, ANON_COOKIE } from '@/lib/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const owner = await resolveOwner(req)
  const snapshot = await getUsageSnapshot(owner)

  const res = NextResponse.json(snapshot)
  if (owner.isNewAnon && owner.anonId) {
    res.cookies.set(ANON_COOKIE, owner.anonId, { path: '/', maxAge: 31536000, sameSite: 'lax', httpOnly: true })
  }
  return res
}
