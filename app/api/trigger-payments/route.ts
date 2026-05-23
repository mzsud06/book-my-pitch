import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  // Verify internal secret to prevent unauthorized calls
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const supabase = await createClient()

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

  if (!venue?.stripe_account_id) {
    return NextResponse.json({ error: 'Venue stripe account not configured' }, { status: 500 })
  }

  const perPlayerPitch = Math.round((slot.price * 100) / 10)
  const totalPerPlayer = perPlayerPitch + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE

  const { data: players } = await supabase
    .from('players')
    .select('id, stripe_customer_id, stripe_payment_method_id, name')
    .eq('session_id', sessionId)
    .not('stripe_payment_method_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .limit(10)

  if (!players || players.length < 10) {
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
        application_fee_amount: PLATFORM_FEE_PENCE * 10, // platform takes £0.50 per player = £5 total
        transfer_data: { destination: venue.stripe_account_id },
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
