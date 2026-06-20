import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Supabase service role client — bypasses RLS to update plan
async function updateUserPlan(customerId: string, plan: string, subscriptionId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  await fetch(`${url}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ plan, stripe_subscription_id: subscriptionId }),
  })
}

async function clearUserPlan(customerId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  await fetch(`${url}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ plan: 'free', stripe_subscription_id: null }),
  })
}

async function linkCustomerToUser(customerId: string, email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  // Find profile by email and attach Stripe customer ID
  await fetch(`${url}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ stripe_customer_id: customerId }),
  })
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.customer && session.customer_email) {
        await linkCustomerToUser(session.customer as string, session.customer_email)
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      if (sub.status === 'active' || sub.status === 'trialing') {
        const plan = (sub.metadata?.plan ?? 'creator') as string
        await updateUserPlan(sub.customer as string, plan, sub.id)
      } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
        await clearUserPlan(sub.customer as string)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await clearUserPlan(sub.customer as string)
      break
    }
  }

  return NextResponse.json({ received: true })
}
