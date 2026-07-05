import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
  const reqTs = new Date().toISOString()

  if (!checkRateLimit(`setup-intent:${getClientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { name, phone, sessionId, slotId } = body
    const redactedName = typeof name === 'string' && name.length > 0 ? `${name.slice(0, 1)}***` : '?'
    console.log(`[setup-intent] POST at ${reqTs} slotId=${slotId ?? 'none'} sessionId=${sessionId ?? 'none'} name=${redactedName}`)

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

    const supabase = await createClient()

    // Validate either an existing session (join flow) or a slot (creation flow).
    let stripeMetaExtra: Record<string, string>
    if (sessionId) {
      if (!isValidUUID(sessionId)) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
      }
      const { data: session } = await supabase
        .from('sessions')
        .select('id, status')
        .eq('id', sessionId)
        .maybeSingle()
      if (!session || session.status !== 'filling') {
        return NextResponse.json({ error: 'Session not found or no longer accepting players' }, { status: 404 })
      }
      stripeMetaExtra = { session_id: sessionId }
    } else if (slotId) {
      if (!isValidUUID(slotId)) {
        return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
      }
      const { data: slot } = await supabase
        .from('slots')
        .select('id')
        .eq('id', slotId)
        .maybeSingle()
      if (!slot) {
        return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
      }
      stripeMetaExtra = { slot_id: slotId }
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      name: trimmedName,
      phone: trimmedPhone,
      metadata: { source: 'bookmypitch', ...stripeMetaExtra },
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

    console.log(`[setup-intent] created customer=${customer.id} intent=${setupIntent.id} at ${new Date().toISOString()}`)
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
