'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import AuthButton from '@/components/AuthButton'
import Logo from '@/components/Logo'

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    period: '',
    color: '#A0A3B1',
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
    ctaStyle: 'border border-ink-500 text-ink-300',
    disabled: true,
    highlight: false,
  },
  {
    key: 'creator',
    name: 'Creator',
    price: 19.99,
    period: '/mo',
    color: '#8676FF',
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
    ctaStyle: 'bg-accent-500 hover:bg-accent-600 text-white',
    disabled: false,
    highlight: true,
  },
  {
    key: 'studio',
    name: 'Studio',
    price: 49.99,
    period: '/mo',
    color: '#FB923C',
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
    highlight: false,
  },
  {
    key: 'cinema',
    name: 'Cinema',
    price: 149,
    period: '/mo',
    color: '#F472B6',
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
    highlight: false,
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
    <div className="min-h-screen bg-ink text-ink-50">
      {/* Nav */}
      <div className="border-b border-ink-500 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3 sm:gap-4">
            <AuthButton />
            <a href="/" className="hidden sm:inline text-sm text-ink-300 hover:text-ink-50 transition-colors">← Back to Studio</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4 text-ink-50">
            Simple, transparent pricing
          </h1>
          <p className="text-ink-200 text-base sm:text-lg max-w-xl mx-auto">
            Turn any idea into a short video in 90 seconds. Start free, upgrade when you&apos;re ready.
          </p>
          {cancelled && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              Payment cancelled — no charge was made.
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14 sm:mb-16">
          {PLANS.map(plan => (
            <div
              key={plan.key}
              className="relative flex flex-col rounded-2xl border bg-ink-700 overflow-hidden transition-all"
              style={{
                borderColor: plan.highlight ? plan.color : '#23252F',
                boxShadow: plan.highlight ? `0 0 0 1px ${plan.color}40, 0 12px 40px -12px ${plan.color}30` : 'none',
              }}
            >
              {plan.badge && (
                <div className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${plan.color}22`, color: plan.color, border: `1px solid ${plan.color}55` }}>
                  {plan.badge}
                </div>
              )}

              <div className="p-6 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: plan.color }}>{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold font-display text-ink-50">${plan.price}</span>
                  <span className="text-sm text-ink-300">{plan.period}</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2 text-[13px] text-ink-100">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                  {plan.missing.map(f => (
                    <div key={f} className="flex items-start gap-2 text-[13px] text-ink-400 line-through">
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
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${plan.ctaStyle}`}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-14 sm:mb-16">
          {[
            { stat: '90s', label: 'Average time to first video' },
            { stat: '$0.05', label: 'Cost per Creator video' },
            { stat: '7', label: 'Content types supported' },
          ].map(s => (
            <div key={s.stat} className="bg-ink-700 border border-ink-500 rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold font-display text-ink-50 mb-1">{s.stat}</div>
              <div className="text-[13px] text-ink-300">{s.label}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-xl font-bold text-center mb-8 text-ink-50">Frequently Asked Questions</h2>
          <div className="flex flex-col gap-3">
            {FAQ.map(item => (
              <details key={item.q} className="bg-ink-700 border border-ink-500 rounded-xl group">
                <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-ink-100 list-none flex items-center justify-between gap-3 hover:text-ink-50 transition-colors">
                  {item.q}
                  <span className="shrink-0 text-ink-300 group-open:rotate-180 transition-transform text-xs">▼</span>
                </summary>
                <div className="px-5 pb-4 text-[13px] text-ink-200 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-14 sm:mt-16 text-center">
          <p className="text-ink-300 text-sm mb-4">All plans include a 7-day money-back guarantee. No questions asked.</p>
          <a href="/" className="text-accent-400 hover:text-accent-400/80 text-sm font-semibold transition-colors">
            ← Try it free first — no signup required
          </a>
          <div className="mt-8 flex items-center justify-center gap-4 text-[12px] text-ink-300">
            <a href="/privacy" className="hover:text-ink-100 transition-colors">Privacy Policy</a>
            <span className="text-ink-500">·</span>
            <a href="/terms" className="hover:text-ink-100 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <PricingContent />
    </Suspense>
  )
}
