'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<'loading' | 'done'>('loading')

  useEffect(() => {
    // Small delay to let webhook process
    const t = setTimeout(() => setStatus('done'), 2000)
    return () => clearTimeout(t)
  }, [sessionId])

  return (
    <div className="min-h-screen bg-[#0a0815] text-white flex items-center justify-center px-6" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style suppressHydrationWarning>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Fredoka+One&display=swap');`}</style>
      <div className="max-w-md w-full text-center">
        {status === 'loading' ? (
          <>
            <div className="w-12 h-12 border-4 border-violet-800 border-t-violet-400 rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Activating your plan...</h1>
            <p className="text-slate-400 text-sm">Confirming payment with Stripe</p>
          </>
        ) : (
          <>
            <div className="text-7xl mb-6">🎉</div>
            <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Fredoka One', cursive", background: 'linear-gradient(135deg,#ff6b9d,#c77dff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Welcome to AI Creative Studio!
            </h1>
            <p className="text-slate-300 text-sm mb-8 leading-relaxed">
              Your subscription is active. Sign in with Google to unlock your plan — use the same email you checked out with.
            </p>
            <div className="flex flex-col gap-3">
              <a href="/"
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg,#ff6b9d,#c77dff)' }}>
                ✨ Start Creating
              </a>
              <a href="/pricing"
                className="w-full py-3 rounded-xl font-bold text-sm text-slate-300 border border-slate-700 hover:border-violet-500 transition-all">
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
    <Suspense fallback={<div className="min-h-screen bg-[#0a0815]" />}>
      <SuccessContent />
    </Suspense>
  )
}
