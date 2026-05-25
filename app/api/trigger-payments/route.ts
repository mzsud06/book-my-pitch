import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  // Verify internal secret to prevent unauthorized calls
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // Service-role client bypasses RLS so we can read all players' payment data,
  // update session status, and insert the booking row from a server-side context.
  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('*, slots(*)')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.status === 'confirmed') return NextResponse.json({ message: 'Already confirmed' })

  const slot = session.slots
  const { data: venue } = await supabase
    .from('venues')
    .select('stripe_account_id')
    .eq('id', slot.venue_id)
    .single()

  const venueStripeAccountId: string | null = venue?.stripe_account_id ?? null
  if (!venueStripeAccountId) {
    console.warn('Venue has no stripe_account_id — charging directly to platform account (test mode fallback)')
  }

  const perPlayerPitch = Math.round((slot.price * 100) / 10)
  const totalPerPlayer = perPlayerPitch + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE

  const capacity: number = slot.max_players ?? 10

  const { data: players } = await supabase
    .from('players')
    .select('id, stripe_customer_id, stripe_payment_method_id, name')
    .eq('session_id', sessionId)
    .not('stripe_payment_method_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .limit(capacity)

  if (!players || players.length < capacity) {
    return NextResponse.json({ error: 'Not enough players' }, { status: 400 })
  }

  const results = await Promise.allSettled(
    players.map(async (player: { id: string; stripe_customer_id: string; stripe_payment_method_id: string; name: string }) => {
      const pi = await stripe.paymentIntents.create({
        amount: totalPerPlayer,
        currency: 'gbp',
        customer: player.stripe_customer_id,
        payment_method: player.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `BookMyPitch — Globe Pitch ${slot.start_time}–${slot.end_time} ${slot.date}`,
        // Only add Connect params when the venue has a Stripe account configured.
        // Without them, the charge goes directly to the platform account (test fallback).
        ...(venueStripeAccountId ? {
          // PLATFORM_FEE_PENCE is the per-player platform fee (£0.50).
          // Each PaymentIntent covers one player, so the fee is per-intent, not ×10.
          application_fee_amount: PLATFORM_FEE_PENCE,
          transfer_data: { destination: venueStripeAccountId },
        } : {}),
        metadata: { session_id: sessionId, player_id: player.id },
      })
      return { pi, player }
    })
  )

  const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as { pi: { status: string } }).pi.status !== 'succeeded'))

  if (failures.length === 0) {
    await supabase.from('sessions').update({ status: 'confirmed' }).eq('id', sessionId)
    await supabase.from('bookings').insert({
      session_id: sessionId,
      slot_id: slot.id,
      confirmed_at: new Date().toISOString(),
    })
    return NextResponse.json({ success: true, message: 'All payments succeeded, session confirmed' })
  } else {
    const failedNames = failures.map(r => r.status === 'fulfilled' ? (r.value as { player: { name: string } }).player.name : 'unknown')
    return NextResponse.json({
      success: false,
      message: 'Some payments failed',
      failedPlayers: failedNames,
    }, { status: 422 })
  }
}
