import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJs } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { ANON_COOKIE } from '@/lib/usage'
import type { VideoJob } from '@/types'

export const dynamic = 'force-dynamic'

// Bare service-role client, no cookie/session coupling — using the
// cookie-aware SSR client here would pick up the session cookies
// exchangeCodeForSession just set on this same request and authorize as
// `authenticated` instead of `service_role`, defeating the RLS bypass
// `video_jobs` needs (RLS enabled, no policies — service-role only).
// Matches the pattern already used in jobStore.ts/usage.ts.
function serviceClient() {
  return createSupabaseJs(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Anonymous generation uses owner_key = `anon:<cookie-uuid>`; signing in
// switches to `user:<supabase-uuid>` with no link between the two. Without
// this, every video generated before signing up becomes permanently
// unreachable the moment a user actually creates an account — exactly the
// conversion moment the /videos history is supposed to reward.
async function claimAnonHistory(request: NextRequest, userId: string) {
  const anonId = request.cookies.get(ANON_COOKIE)?.value
  if (!anonId) return

  const fromKey = `anon:${anonId}`
  const toKey = `user:${userId}`
  const service = serviceClient()
  const { data: rows } = await service.from('video_jobs').select('id, data').eq('owner_key', fromKey)
  if (!rows?.length) return

  for (const row of rows) {
    const job = { ...(row.data as VideoJob), ownerKey: toKey }
    await service.from('video_jobs').update({ owner_key: toKey, data: job }).eq('id', row.id)
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      try { await claimAnonHistory(request, data.user.id) } catch { /* best-effort — don't block sign-in on this */ }
      const response = NextResponse.redirect(`${origin}${next}`)
      response.cookies.delete(ANON_COOKIE)
      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
