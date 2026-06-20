'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
    <div className="min-h-screen bg-[#0a0815] text-white flex items-center justify-center px-6" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style suppressHydrationWarning>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');`}</style>
      <div className="max-w-sm w-full">
        <a href="/" className="block text-center text-xl font-bold mb-8" style={{ fontFamily: "'Fredoka One', cursive", background: 'linear-gradient(135deg,#ff6b9d,#c77dff,#4cc9f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ✨ AI Creative Studio
        </a>

        {status === 'sent' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📬</div>
            <h1 className="text-lg font-bold mb-2">Check your email</h1>
            <p className="text-slate-400 text-sm">We sent a sign-in link to <span className="text-slate-200">{email}</span>. Click it to continue.</p>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h1 className="text-lg font-bold mb-1">Sign in</h1>
            <p className="text-slate-400 text-sm mb-5">We&apos;ll email you a magic link — no password needed.</p>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500 transition-colors mb-3"
            />
            {error && <div className="text-rose-400 text-xs mb-3">{error}</div>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#ff6b9d,#c77dff)' }}
            >
              {status === 'sending' ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
              ) : 'Send magic link'}
            </button>
          </form>
        )}

        <a href="/" className="block text-center text-slate-500 hover:text-slate-300 text-sm mt-6 transition-colors">
          ← Back to Studio
        </a>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0815]" />}>
      <SignInContent />
    </Suspense>
  )
}
