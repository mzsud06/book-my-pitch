import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rateLimit'
import { ensureOrganiserAccount } from '@/lib/organiser'

// Creates the organiser's Stripe Express account if needed and returns a
// fresh onboarding link (links are single-use and expire quickly).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (!checkRateLimit(`organiser-onboarding:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const accountId = await ensureOrganiserAccount(user)
    const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/create`,
      return_url: `${base}/create`,
      type: 'account_onboarding',
    })
    return NextResponse.json({ url: link.url })
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      console.error('organiser onboarding Stripe error:', { type: err.type, code: err.code, message: err.message })
    } else {
      console.error('organiser onboarding error:', err)
    }
    return NextResponse.json({ error: 'Could not start payout setup. Please try again.' }, { status: 500 })
  }
}
