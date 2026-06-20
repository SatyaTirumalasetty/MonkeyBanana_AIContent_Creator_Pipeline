import Logo from '@/components/Logo'

export default function LegalLayout({ title, updated, children }: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-ink text-ink-50">
      <div className="border-b border-ink-500 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <Logo />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <a href="/" className="text-accent-400 hover:text-accent-400/80 text-sm font-semibold transition-colors">
          ← Back to AI Creative Studio
        </a>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-50 mt-6 mb-2">{title}</h1>
        <p className="text-ink-300 text-sm mb-10">Last updated: {updated}</p>
        <div className="flex flex-col gap-7 text-[14px] leading-relaxed text-ink-200 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-50 [&_h2]:mt-2 [&_strong]:text-ink-100 [&_strong]:font-semibold [&_a]:text-accent-400 [&_a]:hover:text-accent-400/80 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:list-disc">
          {children}
        </div>
      </div>
    </div>
  )
}
