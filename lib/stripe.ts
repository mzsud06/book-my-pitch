import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const PLATFORM_FEE_PENCE = 50 // £0.50 in pence
export const STRIPE_PROCESSING_PENCE = 30 // ~30p handling shown to user
