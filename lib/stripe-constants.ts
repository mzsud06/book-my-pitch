// Safe to import from client components (no Stripe secret key here).
export const PLATFORM_FEE_PENCE = 50 // kept by BookMyPitch
export const STRIPE_PROCESSING_PENCE = 29 // covers Stripe's card fee
export const PLAYER_FEE_PENCE = PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE // 79p, charged to each player on top of their share
