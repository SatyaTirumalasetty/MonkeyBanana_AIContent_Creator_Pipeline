'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

function SignInContent() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/'
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}` },
      })
      if (error) throw error
      setStatus('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-ink text-ink-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {status === 'sent' ? (
          <div className="bg-ink-700 border border-ink-500 rounded-2xl p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-accent-soft/10 border border-accent-500/30 flex items-center justify-center mx-auto mb-4 text-xl">
              ✉️
            </div>
            <h1 className="font-display text-lg font-bold mb-2">Check your email</h1>
            <p className="text-ink-200 text-sm leading-relaxed">We sent a sign-in link to <span className="text-ink-50 font-medium">{email}</span>. Click it to continue.</p>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="bg-ink-700 border border-ink-500 rounded-2xl p-7">
            <h1 className="font-display text-lg font-bold mb-1.5">Sign in</h1>
            <p className="text-ink-200 text-sm mb-6">We&apos;ll email you a magic link — no password needed.</p>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-1.5">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-ink-600 border border-ink-500 text-sm text-ink-50 placeholder-ink-300 outline-none focus:border-accent-500 transition-colors mb-4"
            />
            {error && <div className="text-rose-400 text-xs mb-4">{error}</div>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-accent-500 hover:bg-accent-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'sending' ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
              ) : 'Send magic link'}
            </button>
          </form>
        )}

        <a href="/" className="block text-center text-ink-300 hover:text-ink-50 text-sm mt-6 transition-colors">
          ← Back to Studio
        </a>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <SignInContent />
    </Suspense>
  )
}
