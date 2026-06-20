import { NextRequest } from 'next/server'
import { createClient as createSupabaseJs } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { PLANS, type PlanKey } from '@/lib/stripe'

export const ANON_COOKIE = 'aics_anon_id'
export const FREE_VIDEO_LIMIT = 3

export type Plan = PlanKey | 'free'

export interface OwnerContext {
  ownerKey: string
  plan: Plan
  anonId?: string
  isNewAnon: boolean
  brandBrief?: string
}

function serviceClient() {
  return createSupabaseJs(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Identifies the caller as a logged-in user (with their billing plan) or, for
// anonymous visitors, a cookie-backed id so the free quota can't be reset by
// just clearing localStorage.
export async function resolveOwner(req: NextRequest): Promise<OwnerContext> {
  try {
    const supabase = createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('plan, brand_brief').eq('id', user.id).single()
      const plan = (profile?.plan as Plan) ?? 'free'
      // Brand brief memory is a Studio/Cinema perk — gate it here so callers
      // don't need to re-check the plan themselves.
      const brandBrief = (plan === 'studio' || plan === 'cinema') ? profile?.brand_brief ?? undefined : undefined
      return { ownerKey: `user:${user.id}`, plan, isNewAnon: false, brandBrief }
    }
  } catch { /* Supabase not configured or no session — fall back to anon */ }

  const existing = req.cookies.get(ANON_COOKIE)?.value
  const anonId = existing ?? crypto.randomUUID()
  return { ownerKey: `anon:${anonId}`, plan: 'free', anonId, isNewAnon: !existing }
}

export interface QuotaResult {
  allowed: boolean
  useKling: boolean
  useFlux: boolean
  reason?: string
}

// Atomically checks the owner's plan limits against this month's usage and,
// if allowed, reserves the slot in the same database call.
export async function checkAndReserveUsage(owner: OwnerContext): Promise<QuotaResult> {
  const month = new Date().toISOString().slice(0, 7)
  const planConfig = owner.plan !== 'free' ? PLANS[owner.plan] : null
  const videoLimit = planConfig ? planConfig.videoLimit : FREE_VIDEO_LIMIT
  const klingLimit = planConfig?.klingLimit ?? 0

  const { data, error } = await serviceClient().rpc('reserve_usage', {
    p_owner_key: owner.ownerKey,
    p_month: month,
    p_video_limit: videoLimit,
    p_kling_limit: klingLimit,
  }).single()

  if (error) throw new Error(`reserve_usage failed: ${error.message}`)
  const result = data as { allowed: boolean; use_kling: boolean }

  if (!result.allowed) {
    return {
      allowed: false,
      useKling: false,
      useFlux: false,
      reason: owner.plan === 'free'
        ? `You've used all ${FREE_VIDEO_LIMIT} free videos this month. Upgrade to keep creating.`
        : `Monthly video limit reached for the ${planConfig?.name} plan.`,
    }
  }

  // Flux (AI image-to-video) is a paid-plan perk — free/anonymous users get
  // the no-cost canvas fallback only.
  return { allowed: true, useKling: result.use_kling, useFlux: owner.plan !== 'free' }
}

export async function getUsageSnapshot(owner: OwnerContext) {
  const month = new Date().toISOString().slice(0, 7)
  const { data } = await serviceClient()
    .from('usage_counters')
    .select('video_count, kling_count')
    .eq('owner_key', owner.ownerKey)
    .eq('month', month)
    .maybeSingle()

  const planConfig = owner.plan !== 'free' ? PLANS[owner.plan] : null
  return {
    plan: owner.plan,
    videoCount: data?.video_count ?? 0,
    videoLimit: planConfig ? planConfig.videoLimit : FREE_VIDEO_LIMIT,
    klingCount: data?.kling_count ?? 0,
    klingLimit: planConfig?.klingLimit ?? 0,
  }
}
