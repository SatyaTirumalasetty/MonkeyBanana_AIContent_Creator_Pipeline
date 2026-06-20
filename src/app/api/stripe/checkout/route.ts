import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const { plan } = await req.json() as { plan: PlanKey }
  if (!PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const planConfig = PLANS[plan]
  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  // Get authenticated user if available
  let customerEmail: string | undefined
  let stripeCustomerId: string | undefined
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      customerEmail = user.email
      // Look up existing Stripe customer
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()
      if (profile?.stripe_customer_id) stripeCustomerId = profile.stripe_customer_id
    }
  } catch { /* Supabase not configured or user not logged in — proceed as guest */ }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?cancelled=1`,
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
    subscription_data: {
      metadata: { plan },
    },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
