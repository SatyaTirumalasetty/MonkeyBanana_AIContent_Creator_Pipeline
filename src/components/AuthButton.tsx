'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PLAN_LABEL: Record<string, string> = {
  free: 'Free', creator: 'Creator', studio: 'Studio', cinema: 'Cinema',
}

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('free')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setReady(true); return }
    const supabase = createClient()

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
        setPlan(profile?.plan ?? 'free')
      }
      setReady(true)
    }
    loadUser()

    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser())
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setEmail(null)
    setPlan('free')
  }

  if (!ready) return null

  if (!email) {
    return (
      <a href="/signin" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent-500 text-white text-[12px] font-semibold hover:bg-accent-600 transition-colors">
        Sign in
      </a>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <a href="/account" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink-500 bg-ink-700 text-[12px] font-medium text-ink-200 hover:border-accent-500 hover:text-ink-50 transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="max-w-[140px] truncate">{email}</span>
        <span className="text-accent-400 font-semibold">· {PLAN_LABEL[plan] ?? plan}</span>
      </a>
      <button onClick={signOut} className="text-[12px] font-medium text-ink-300 hover:text-ink-50 transition-colors">
        Sign out
      </button>
    </div>
  )
}
