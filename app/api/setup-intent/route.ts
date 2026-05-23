import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

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

    // Create SetupIntent for saving payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session',
    })

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    })
  } catch (err) {
    console.error('setup-intent error:', err)
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 })
  }
}
