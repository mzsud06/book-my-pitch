import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const PLATFORM_FEE_PENCE = 50 // £0.50 in pence
export const STRIPE_PROCESSING_PENCE = 30 // ~30p handling shown to user

export function getPitchPrice(slotType: 'offpeak' | 'peak' | 'weekend'): number {
  // Returns price in pence
  switch (slotType) {
    case 'offpeak': return 2500  // £25
    case 'peak':    return 4500  // £45
    case 'weekend': return 3500  // £35
  }
}

export function getPerPlayerAmount(slotType: 'offpeak' | 'peak' | 'weekend'): number {
  const pitchPrice = getPitchPrice(slotType)
  return Math.round(pitchPrice / 10) + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE
}
