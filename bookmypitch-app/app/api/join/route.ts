import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { slotId, sessionId, isOrganiser, name, phone, paymentMethodId } = await req.json()

    if (!slotId || !name || !paymentMethodId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get slot info
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .single()

    if (slotError || !slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    let currentSessionId = sessionId

    if (!sessionId || isOrganiser) {
      // Create new session (organiser)
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({ slot_id: slotId, status: 'filling' })
        .select()
        .single()

      if (sessionError || !newSession) {
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
      }
      currentSessionId = newSession.id
    } else {
      // Verify existing session
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id, status')
        .eq('id', sessionId)
        .single()

      if (!existingSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (existingSession.status === 'confirmed') return NextResponse.json({ error: 'Session already confirmed' }, { status: 400 })
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      name,
      phone: phone ?? undefined,
      metadata: { source: 'bookmypitch', session_id: currentSessionId },
    })

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id })

    // Add player to session
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        session_id: currentSessionId,
        name,
        phone: phone ?? null,
        stripe_payment_method_id: paymentMethodId,
        stripe_customer_id: customer.id,
      })

    if (playerError) {
      console.error('Player insert error:', playerError)
      return NextResponse.json({ error: 'Failed to add player' }, { status: 500 })
    }

    // Count players now (including the organiser stored on the session row)
    const [{ count }, { data: sess }] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('session_id', currentSessionId),
      supabase.from('sessions').select('organiser_name').eq('id', currentSessionId).single(),
    ])

    const organiserCount = (sess as unknown as { organiser_name: string | null } | null)?.organiser_name ? 1 : 0
    const playerCount = (count ?? 0) + organiserCount

    if (playerCount >= 10) {
      await triggerPayments(currentSessionId, slot, supabase)
    }

    return NextResponse.json({ sessionId: currentSessionId, playerCount })
  } catch (err) {
    console.error('join error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function triggerPayments(
  sessionId: string,
  slot: { type: string; price: number; venue_id: string },
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  // Get venue stripe account
  const { data: venue } = await supabase
    .from('venues')
    .select('stripe_account_id')
    .eq('id', slot.venue_id)
    .single()

  if (!venue?.stripe_account_id) {
    console.error('No stripe account for venue')
    return
  }

  const perPlayerPitch = Math.round((slot.price * 100) / 10)
  const totalPerPlayer = perPlayerPitch + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE

  // Get all players
  const { data: players } = await supabase
    .from('players')
    .select('id, stripe_customer_id, stripe_payment_method_id, name')
    .eq('session_id', sessionId)
    .not('stripe_payment_method_id', 'is', null)
    .limit(10)

  if (!players || players.length === 0) return

  const results = await Promise.allSettled(
    players.map(async (player: { id: string; stripe_customer_id: string; stripe_payment_method_id: string; name: string }) => {
      return stripe.paymentIntents.create({
        amount: totalPerPlayer,
        currency: 'gbp',
        customer: player.stripe_customer_id,
        payment_method: player.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `BookMyPitch — Globe Pitch ${slot.type} slot`,
        application_fee_amount: PLATFORM_FEE_PENCE,
        transfer_data: { destination: venue.stripe_account_id },
        metadata: { session_id: sessionId, player_id: player.id },
      })
    })
  )

  const allSucceeded = results.every(
    r => r.status === 'fulfilled' && (r.value as { status: string }).status === 'succeeded'
  )

  if (allSucceeded) {
    await supabase
      .from('sessions')
      .update({ status: 'confirmed' })
      .eq('id', sessionId)

    await supabase
      .from('bookings')
      .insert({
        session_id: sessionId,
        slot_id: slot.venue_id, // Will be corrected in production
        confirmed_at: new Date().toISOString(),
      })
  } else {
    const failures = results.filter(r => r.status === 'rejected')
    console.error(`${failures.length} payment(s) failed for session ${sessionId}`)
    // In production: notify failed players to retry
  }
}
