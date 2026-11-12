import Stripe from 'stripe'

export { PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE, PLAYER_FEE_PENCE } from '@/lib/stripe-constants'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})
