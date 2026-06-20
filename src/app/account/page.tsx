'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PLAN_META: Record<string, { label: string; price: string; color: string }> = {
  free: { label: 'Free', price: '$0/mo', color: '#64748b' },
  creator: { label: 'Creator', price: '$19.99/mo', color: '#c77dff' },
  studio: { label: 'Studio', price: '$49.99/mo', color: '#ff9f43' },
  cinema: { label: 'Cinema', price: '$149/mo', color: '#f472b6' },
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

  if (!ready) return <div className="min-h-screen bg-[#0a0815]" />

  const meta = PLAN_META[plan] ?? PLAN_META.free

  return (
    <div className="min-h-screen bg-[#0a0815] text-white" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style suppressHydrationWarning>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');`}</style>

      <div className="border-b border-slate-800 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold" style={{ fontFamily: "'Fredoka One', cursive", background: 'linear-gradient(135deg,#ff6b9d,#c77dff,#4cc9f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ✨ AI Creative Studio
          </a>
          <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">← Back to Studio</a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: "'Fredoka One', cursive" }}>My Account</h1>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Signed in as</div>
          <div className="text-sm text-slate-200">{email}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Current plan</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-sm text-slate-500">{meta.price}</span>
              </div>
            </div>
            {plan === 'free' && (
              <a href="/pricing" className="px-4 py-2 rounded-xl font-bold text-sm text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#ff6b9d,#c77dff)' }}>
                Upgrade
              </a>
            )}
          </div>

          {error && <div className="text-rose-400 text-xs mb-3">{error}</div>}

          {hasSubscription ? (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="w-full py-3 rounded-xl font-bold text-sm border border-slate-700 text-slate-300 hover:border-violet-500 hover:text-violet-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {portalLoading ? (
                <><div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />Opening billing portal...</>
              ) : '💳 Manage billing & subscription'}
            </button>
          ) : (
            <p className="text-slate-500 text-sm">No active subscription. <a href="/pricing" className="text-violet-400 hover:text-violet-300">View plans →</a></p>
          )}
        </div>

        <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  )
}
