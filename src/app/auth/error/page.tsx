export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-[#0a0815] text-white flex items-center justify-center px-6" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="max-w-sm w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-bold mb-2">Sign-in link expired or invalid</h1>
        <p className="text-slate-400 text-sm mb-6">Magic links expire after a short time. Request a new one to continue.</p>
        <a href="/signin" className="inline-block px-5 py-3 rounded-xl font-bold text-sm text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#ff6b9d,#c77dff)' }}>
          Try again
        </a>
      </div>
    </div>
  )
}
