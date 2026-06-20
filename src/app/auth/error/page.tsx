import Logo from '@/components/Logo'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-ink text-ink-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-sm w-full text-center">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="bg-ink-700 border border-ink-500 rounded-2xl p-7">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
          <h1 className="font-display text-lg font-bold mb-2">Sign-in link expired or invalid</h1>
          <p className="text-ink-200 text-sm mb-6 leading-relaxed">Magic links expire after a short time. Request a new one to continue.</p>
          <a href="/signin" className="inline-block w-full px-5 py-3 rounded-xl font-semibold text-sm text-white bg-accent-500 hover:bg-accent-600 transition-colors">
            Try again
          </a>
        </div>
      </div>
    </div>
  )
}
