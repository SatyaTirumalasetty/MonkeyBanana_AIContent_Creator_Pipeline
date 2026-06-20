import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
})

export const PLANS = {
  creator: {
    name: 'Creator',
    price: 1999,
    priceId: process.env.STRIPE_CREATOR_PRICE_ID!,
    interval: 'month' as const,
    videoLimit: null,         // unlimited Flux
    klingLimit: 0,
    features: [
      'Unlimited AI image videos',
      'No watermarks',
      '7 content types',
      'Social captions for 4 platforms',
      'Download in HD',
    ],
  },
  studio: {
    name: 'Studio',
    price: 4999,
    priceId: process.env.STRIPE_STUDIO_PRICE_ID!,
    interval: 'month' as const,
    videoLimit: null,
    klingLimit: 20,
    features: [
      'Everything in Creator',
      '20 Kling AI videos/month',
      'Priority rendering queue',
      'Custom brand brief',
    ],
  },
  cinema: {
    name: 'Cinema',
    price: 14900,
    priceId: process.env.STRIPE_CINEMA_PRICE_ID!,
    interval: 'month' as const,
    videoLimit: null,
    klingLimit: 50,
    features: [
      'Everything in Studio',
      '50 Kling AI videos/month',
      'Dedicated render pipeline',
      'API access',
      'Team seats (up to 5)',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS
