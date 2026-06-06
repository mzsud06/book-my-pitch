import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, sessionId } = body

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || trimmedName.length > 100) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!/^[A-Za-z\s'-]+$/.test(trimmedName)) {
      return NextResponse.json({ error: 'Name contains invalid characters' }, { status: 400 })
    }

    const trimmedPhone = typeof phone === 'string' ? phone.trim() : ''
    if (!trimmedPhone || !/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    // Validate that the session exists and is still accepting players.
    // This prevents Stripe customers/SetupIntents being created for invalid sessions.
    if (!isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: session } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session || session.status !== 'filling') {
      return NextResponse.json({ error: 'Session not found or no longer accepting players' }, { status: 404 })
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      name: trimmedName,
      phone: trimmedPhone,
      metadata: { source: 'bookmypitch', session_id: sessionId },
    })

    // Create SetupIntent for saving payment method.
    // allow_redirects:'never' ensures only instant-confirm methods (cards, etc.) appear.
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
    if (err instanceof Stripe.errors.StripeError) {
      console.error('setup-intent Stripe error:', {
        type: err.type,
        code: err.code,
        message: err.message,
      })
    } else {
      console.error('setup-intent error:', err)
    }
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 })
  }
}
