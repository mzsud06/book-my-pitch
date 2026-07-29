import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

// Both the same page: the owner dashboard self-checks onboarding status on
// every load (see app/owner/dashboard/page.tsx) and shows a "Set up
// payouts" retry button while incomplete, so there's no need for a
// dedicated return/refresh page — landing back on the dashboard after
// either a completed or an abandoned/expired Stripe session both just work.
function dashboardUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/owner/dashboard`
}

// Creates the venue's Stripe Express Connect account if it doesn't exist yet,
// then always issues a fresh onboarding link (account links expire quickly
// and can only be used once). Reused by: the signup flow immediately after
// account creation, the dashboard's "Set up payouts" / "Finish onboarding"
// button, and as the effective retry path when a link expires mid-flow.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (!checkRateLimit(`owner-stripe-link:${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { venueId } = body

    if (!isValidUUID(venueId)) {
      return NextResponse.json({ error: 'Invalid venue' }, { status: 400 })
    }

    const svc = createServiceClient()
    const { data: venue } = await svc
      .from('venues')
      .select('id, name, owner_id, stripe_account_id')
      .eq('id', venueId)
      .single()

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }
    if (venue.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let accountId = venue.stripe_account_id as string | null

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: user.email,
        business_profile: {
          name: venue.name as string,
          product_description: 'Football pitch bookings via BookMyPitch',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
      accountId = account.id

      const { error: updateError } = await svc
        .from('venues')
        .update({ stripe_account_id: accountId })
        .eq('id', venueId)

      if (updateError) {
        console.error('stripe-onboarding-link: failed to save stripe_account_id:', updateError.message)
        return NextResponse.json({ error: 'Failed to start Stripe onboarding. Please try again.' }, { status: 500 })
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: dashboardUrl(),
      return_url: dashboardUrl(),
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      console.error('stripe-onboarding-link Stripe error:', { type: err.type, code: err.code, message: err.message })
    } else {
      console.error('stripe-onboarding-link error:', err)
    }
    return NextResponse.json({ error: 'Failed to start Stripe onboarding. Please try again.' }, { status: 500 })
  }
}
