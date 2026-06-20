export default function Logo({ subtitle, size = 'md' }: { subtitle?: string; size?: 'sm' | 'md' }) {
  const markSize = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm'
  const textSize = size === 'sm' ? 'text-base' : 'text-lg'
  return (
    <a href="/" className="inline-flex items-center gap-2.5 group">
      <span
        className={`${markSize} shrink-0 rounded-lg flex items-center justify-center font-bold text-white transition-transform group-hover:scale-105`}
        style={{ background: 'linear-gradient(135deg,#6D5DFC,#22D3EE)' }}
      >
        ✦
      </span>
      <span className="flex flex-col leading-none">
        <span className={`${textSize} font-display font-bold text-ink-50 tracking-tight`}>AI Creative Studio</span>
        {subtitle && <span className="text-[11px] text-ink-300 mt-0.5">{subtitle}</span>}
      </span>
    </a>
  )
}
