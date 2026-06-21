'use client'
import { useState } from 'react'
import { Copy, Check } from '@/components/icons'

export default function CopyButton({ text, label = 'Copy caption' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${copied ? 'bg-emerald-500/10 border-emerald-600 text-emerald-400' : 'bg-ink-600 border-ink-500 text-ink-200 hover:border-accent-500 hover:text-accent-400'}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
