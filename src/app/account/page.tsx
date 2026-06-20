'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

const PLAN_META: Record<string, { label: string; price: string; color: string }> = {
  free: { label: 'Free', price: '$0/mo', color: '#A0A3B1' },
  creator: { label: 'Creator', price: '$19.99/mo', color: '#8676FF' },
  studio: { label: 'Studio', price: '$49.99/mo', color: '#FB923C' },
  cinema: { label: 'Cinema', price: '$149/mo', color: '#F472B6' },
}

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState('free')
  const [hasSubscription, setHasSubscription] = useState(false)
  const [ready, setReady] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/signin?next=/account'; return }
      setEmail(user.email ?? null)
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, stripe_customer_id')
        .eq('id', user.id)
        .single()
      setPlan(profile?.plan ?? 'free')
      setHasSubscription(!!profile?.stripe_customer_id)
      setReady(true)
    }
    load()
  }, [])

  async function openPortal() {
    setPortalLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else { setError(data.error ?? 'Could not open billing portal'); setPortalLoading(false) }
    } catch {
      setError('Could not connect to billing portal')
      setPortalLoading(false)
    }
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (!ready) return <div className="min-h-screen bg-ink" />

  const meta = PLAN_META[plan] ?? PLAN_META.free

  return (
    <div className="min-h-screen bg-ink text-ink-50">
      <div className="border-b border-ink-500 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <a href="/" className="text-sm text-ink-300 hover:text-ink-50 transition-colors">← Back to Studio</a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-2xl font-bold mb-8">My Account</h1>

        <div className="bg-ink-700 border border-ink-500 rounded-2xl p-5 sm:p-6 mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-1.5">Signed in as</div>
          <div className="text-sm text-ink-50">{email}</div>
        </div>

        <div className="bg-ink-700 border border-ink-500 rounded-2xl p-5 sm:p-6 mb-4">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-1.5">Current plan</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-display" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-sm text-ink-300">{meta.price}</span>
              </div>
            </div>
            {plan === 'free' && (
              <a href="/pricing" className="shrink-0 px-4 py-2 rounded-xl font-semibold text-sm text-white bg-accent-500 hover:bg-accent-600 transition-colors">
                Upgrade
              </a>
            )}
          </div>

          {error && <div className="text-rose-400 text-xs mb-3">{error}</div>}

          {hasSubscription ? (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="w-full py-3 rounded-xl font-semibold text-sm border border-ink-500 text-ink-200 hover:border-accent-500 hover:text-ink-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {portalLoading ? (
                <><div className="w-4 h-4 border-2 border-ink-400 border-t-ink-100 rounded-full animate-spin" />Opening billing portal...</>
              ) : 'Manage billing & subscription'}
            </button>
          ) : (
            <p className="text-ink-300 text-sm">No active subscription. <a href="/pricing" className="text-accent-400 hover:text-accent-400/80">View plans →</a></p>
          )}
        </div>

        <button onClick={signOut} className="text-sm text-ink-300 hover:text-ink-50 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  )
}
