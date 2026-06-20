'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Logo from '@/components/Logo'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<'loading' | 'done'>('loading')

  useEffect(() => {
    const t = setTimeout(() => setStatus('done'), 2000)
    return () => clearTimeout(t)
  }, [sessionId])

  return (
    <div className="min-h-screen bg-ink text-ink-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-10">
          <Logo />
        </div>
        {status === 'loading' ? (
          <>
            <div className="w-10 h-10 border-[3px] border-ink-400 border-t-accent-400 rounded-full animate-spin mx-auto mb-6" />
            <h1 className="font-display text-xl font-bold mb-2">Activating your plan...</h1>
            <p className="text-ink-300 text-sm">Confirming payment with Stripe</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg,#6D5DFC,#22D3EE)' }}>
              ✓
            </div>
            <h1 className="font-display text-2xl font-bold mb-3">Welcome to AI Creative Studio!</h1>
            <p className="text-ink-200 text-sm mb-8 leading-relaxed">
              Your subscription is active. Sign in with the same email you checked out with to unlock your plan.
            </p>
            <div className="flex flex-col gap-3">
              <a href="/"
                className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-accent-500 hover:bg-accent-600 transition-colors">
                Start Creating
              </a>
              <a href="/account"
                className="w-full py-3 rounded-xl font-semibold text-sm text-ink-200 border border-ink-500 hover:border-accent-500 hover:text-ink-50 transition-colors">
                View your plan
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <SuccessContent />
    </Suspense>
  )
}
