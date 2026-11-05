// Display-only copy of the per-player fees, in pence, so client components
// can show the full price without importing lib/stripe.ts (which builds a
// server-side Stripe client). Must match PLATFORM_FEE_PENCE and
// STRIPE_PROCESSING_PENCE in lib/stripe.ts, which are what players are charged.
export const PLATFORM_FEE_PENCE_DISPLAY = 50
export const PAYMENT_FEE_PENCE_DISPLAY = 30

export const formatPounds = (pence: number) => `£${(pence / 100).toFixed(2)}`

/** One line, shown before the card step. */
export function perPlayerBreakdown(pitchSharePounds: number) {
  const pitchPence = Math.round(pitchSharePounds * 100)
  const totalPence = pitchPence + PLATFORM_FEE_PENCE_DISPLAY + PAYMENT_FEE_PENCE_DISPLAY
  return {
    pitch: formatPounds(pitchPence),
    platform: formatPounds(PLATFORM_FEE_PENCE_DISPLAY),
    payment: formatPounds(PAYMENT_FEE_PENCE_DISPLAY),
    total: formatPounds(totalPence),
  }
}
