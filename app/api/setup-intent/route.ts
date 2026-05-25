import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const { name, phone } = await req.json()

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      name,
      phone,
      metadata: { source: 'bookmypitch' },
    })

    // Create SetupIntent for saving payment method.
    // IMPORTANT: use automatic_payment_methods (not payment_method_types) so the
    // SetupIntent is compatible with PaymentElement, which is the new Stripe
    // Elements approach.  allow_redirects:'never' ensures only instant-confirm
    // methods (cards, etc.) appear — no iDEAL / Sofort redirect flows.
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      usage: 'off_session',
    })

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    })
  } catch (err) {
    // Log the full Stripe error so we can see the exact code/message in server logs.
    if (err instanceof Stripe.errors.StripeError) {
      console.error('setup-intent Stripe error:', {
        type: err.type,
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        requestId: err.requestId,
      })
    } else {
      console.error('setup-intent error:', err)
    }
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 })
  }
}
