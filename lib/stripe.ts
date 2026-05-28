import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const PLATFORM_FEE_PENCE = 50 // £0.50 in pence
export const STRIPE_PROCESSING_PENCE = 30 // ~30p handling shown to user

export function getPitchPrice(slotType: 'offpeak' | 'peak' | 'weekend'): number {
  // Returns price in pence
  switch (slotType) {
    case 'offpeak': return 3000  // £30
    case 'peak':    return 5000  // £50
    case 'weekend': return 4000  // £40
  }
}

export function getPerPlayerAmount(slotType: 'offpeak' | 'peak' | 'weekend'): number {
  const pitchPrice = getPitchPrice(slotType)
  return Math.round(pitchPrice / 10) + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE
}
