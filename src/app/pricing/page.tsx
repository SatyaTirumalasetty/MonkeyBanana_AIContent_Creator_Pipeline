'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import AuthButton from '@/components/AuthButton'

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    period: '',
    color: '#64748b',
    gradient: 'linear-gradient(135deg,#1e293b,#0f172a)',
    badge: '',
    features: [
      '3 videos / month',
      'AI canvas slideshow',
      'All 7 content types',
      'Social captions (4 platforms)',
      'Watermarked downloads',
    ],
    missing: ['AI image generation', 'Kling AI videos', 'HD downloads', 'No watermarks'],
    cta: 'Current plan',
    ctaStyle: 'border border-slate-600 text-slate-400',
    disabled: true,
  },
  {
    key: 'creator',
    name: 'Creator',
    price: 19.99,
    period: '/mo',
    color: '#c77dff',
    gradient: 'linear-gradient(135deg,#3b0764,#1e1b4b)',
    badge: 'Most Popular',
    features: [
      'Unlimited videos / month',
      'Flux Schnell AI image videos',
      'All 7 content types',
      'Social captions (4 platforms)',
      'HD downloads — no watermark',
      'Priority support',
    ],
    missing: [],
    cta: 'Start Creating',
    ctaStyle: 'bg-violet-600 hover:bg-violet-500 text-white',
    disabled: false,
  },
  {
    key: 'studio',
    name: 'Studio',
    price: 49.99,
    period: '/mo',
    color: '#ff9f43',
    gradient: 'linear-gradient(135deg,#431407,#1a0a2e)',
    badge: 'Best for Teams',
    features: [
      'Everything in Creator',
      '20 Kling AI videos / month',
      'Cinematic video quality',
      'Priority rendering queue',
      'Custom brand brief memory',
      'Team workspace (up to 3)',
    ],
    missing: [],
    cta: 'Go Studio',
    ctaStyle: 'bg-orange-600 hover:bg-orange-500 text-white',
    disabled: false,
  },
  {
    key: 'cinema',
    name: 'Cinema',
    price: 149,
    period: '/mo',
    color: '#f472b6',
    gradient: 'linear-gradient(135deg,#500724,#0f172a)',
    badge: 'Power Users',
    features: [
      'Everything in Studio',
      '50 Kling AI videos / month',
      'Dedicated render pipeline',
      'API access',
      'Team workspace (up to 5)',
      'Custom model fine-tuning',
    ],
    missing: [],
    cta: 'Go Cinema',
    ctaStyle: 'bg-pink-600 hover:bg-pink-500 text-white',
    disabled: false,
  },
]

const FAQ = [
  { q: 'What is a "video"?', a: 'Each full pipeline run — from script to final MP4 — counts as one video. A typical video is 60 seconds made of 12 AI-generated clips.' },
  { q: 'What\'s the difference between Flux and Kling?', a: 'Flux Schnell generates a single AI image per clip with a Ken Burns pan animation (~$0.003/image). Kling AI generates true text-to-video clips with motion (~$7/clip). Creator plan uses Flux; Studio/Cinema use Kling for photorealistic video.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your Stripe billing portal at any time. You keep access until the end of the billing period.' },
  { q: 'Do unused Kling videos roll over?', a: 'No, Kling quotas reset monthly. Flux videos are unlimited on Creator+ plans.' },
  { q: 'Is my content private?', a: 'Yes. Videos are stored in your private Vercel Blob storage and are not shared or used for training.' },
]

function PricingContent() {
  const router = useRouter()
  const params = useSearchParams()
  const cancelled = params.get('cancelled')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(planKey: string) {
    if (planKey === 'free') return
    setLoading(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Something went wrong. Please try again.')
        setLoading(null)
      }
    } catch {
      alert('Could not connect to payment processor. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0815] text-white" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style suppressHydrationWarning>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');`}</style>

      {/* Nav */}
      <div className="border-b border-slate-800 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold" style={{ fontFamily: "'Fredoka One', cursive", background: 'linear-gradient(135deg,#ff6b9d,#c77dff,#4cc9f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ✨ AI Creative Studio
          </a>
          <div className="flex items-center gap-4">
            <AuthButton />
            <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">← Back to Studio</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: "'Fredoka One', cursive", background: 'linear-gradient(135deg,#ff6b9d,#c77dff,#4cc9f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Simple, transparent pricing
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Turn any idea into a short video in 90 seconds. Start free, upgrade when you&apos;re ready.
          </p>
          {cancelled && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-950/60 border border-amber-700 text-amber-300 text-sm">
              ⚠️ Payment cancelled — no charge was made.
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-4 gap-4 mb-16">
          {PLANS.map(plan => (
            <div
              key={plan.key}
              className="relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all"
              style={{
                borderColor: plan.key === 'creator' ? plan.color : '#1e293b',
                background: plan.gradient,
                boxShadow: plan.key === 'creator' ? `0 0 40px ${plan.color}25` : 'none',
              }}
            >
              {plan.badge && (
                <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${plan.color}30`, color: plan.color, border: `1px solid ${plan.color}60` }}>
                  {plan.badge}
                </div>
              )}

              <div className="p-6 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: plan.color }}>{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-sm text-slate-400">{plan.period}</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2 text-[12px] text-slate-200">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                  {plan.missing.map(f => (
                    <div key={f} className="flex items-start gap-2 text-[12px] text-slate-600 line-through">
                      <span className="shrink-0 mt-0.5">✗</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4">
                <button
                  onClick={() => handleCheckout(plan.key)}
                  disabled={plan.disabled || loading === plan.key}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${plan.ctaStyle}`}
                >
                  {loading === plan.key ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Redirecting...</>
                  ) : (
                    plan.cta
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Value prop stats */}
        <div className="grid grid-cols-3 gap-6 mb-16">
          {[
            { stat: '90s', label: 'Average time to first video', icon: '⚡' },
            { stat: '$0.05', label: 'Cost per Creator video', icon: '💰' },
            { stat: '7', label: 'Content types supported', icon: '🎨' },
          ].map(s => (
            <div key={s.stat} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-3xl font-extrabold text-white mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>{s.stat}</div>
              <div className="text-[12px] text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8" style={{ fontFamily: "'Fredoka One', cursive" }}>Frequently Asked Questions</h2>
          <div className="flex flex-col gap-3">
            {FAQ.map(item => (
              <details key={item.q} className="bg-slate-900 border border-slate-800 rounded-xl group">
                <summary className="px-5 py-4 cursor-pointer text-sm font-bold text-slate-200 list-none flex items-center justify-between hover:text-white transition-colors">
                  {item.q}
                  <span className="text-slate-500 group-open:rotate-180 transition-transform text-xs">▼</span>
                </summary>
                <div className="px-5 pb-4 text-[13px] text-slate-400 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 text-sm mb-4">All plans include a 7-day money-back guarantee. No questions asked.</p>
          <a href="/" className="text-violet-400 hover:text-violet-300 text-sm font-bold transition-colors">
            ← Try it free first — no signup required
          </a>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0815]" />}>
      <PricingContent />
    </Suspense>
  )
}
