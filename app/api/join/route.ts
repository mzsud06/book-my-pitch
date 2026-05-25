import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { slotId, sessionId, isOrganiser, name, phone, paymentMethodId, customerId } = await req.json()

    if (!slotId || !name || !paymentMethodId || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get authenticated user (set during auth step in the join flow)
    const { data: { user } } = await supabase.auth.getUser()

    // Get slot info
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .single()

    if (slotError || !slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    // Verify existing session
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id, status, organiser_name')
      .eq('id', sessionId)
      .single()

    if (!existingSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (existingSession.status === 'confirmed') return NextResponse.json({ error: 'Session already confirmed' }, { status: 400 })

    // Duplicate-join guard — run before touching any Stripe resources.
    // Logged-in users are identified by user_id; guests by phone number.
    if (user?.id) {
      const { data: alreadyIn } = await supabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (alreadyIn) {
        return NextResponse.json({ error: "You're already in this game" }, { status: 409 })
      }
    } else if (phone) {
      const { data: alreadyIn } = await supabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('phone', phone)
        .maybeSingle()
      if (alreadyIn) {
        return NextResponse.json({ error: "You're already in this game" }, { status: 409 })
      }
    }

    // Use the customer created during setup-intent (avoids duplicate customer + avoids
    // re-attaching a payment method that Stripe already attached to that customer).
    // If no customerId provided (shouldn't happen with new flow), create one as fallback.
    let stripeCustomerId = customerId
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name,
        phone: phone ?? undefined,
        metadata: { source: 'bookmypitch', session_id: sessionId },
      })
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id })
      stripeCustomerId = customer.id
    }
    // When customerId IS provided, the payment method was already attached to that
    // customer by stripe.confirmSetup — no need to attach again.

    // Add player to session
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        session_id: sessionId,
        user_id: user?.id ?? null,   // Link to auth user so My Bookings works
        name,
        phone: phone ?? null,
        stripe_payment_method_id: paymentMethodId,
        stripe_customer_id: stripeCustomerId,
      })

    if (playerError) {
      console.error('Player insert error:', playerError)
      return NextResponse.json({ error: 'Failed to add player' }, { status: 500 })
    }

    // If the organiser is joining their own session, clear organiser_name so they
    // appear only through the players table (prevents double-counting in the UI).
    if (isOrganiser && existingSession.organiser_name) {
      await supabase
        .from('sessions')
        .update({ organiser_name: null, organiser_phone: null })
        .eq('id', sessionId)
    }

    // Use the service-role client to count players — the anon client is scoped to the
    // current user and RLS may hide other players' rows, giving a wrong count.
    const serviceSupabase = createServiceClient()

    // Count players who have provided payment details.
    // We only trigger when every slot in the session has a paying player behind it —
    // the organiser reserved a spot via organiser_name, but that spot only counts once
    // they have joined via the flow and appear in the players table with a payment method.
    const { count: payingCount } = await serviceSupabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .not('stripe_payment_method_id', 'is', null)
      .not('stripe_customer_id', 'is', null)

    const capacity: number = (slot as unknown as { max_players?: number }).max_players ?? 10
    const playerCount = payingCount ?? 0

    if (playerCount >= capacity) {
      await triggerPayments(sessionId, slot as unknown as SlotForPayment)
    }

    return NextResponse.json({ sessionId, playerCount })
  } catch (err) {
    console.error('join error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface SlotForPayment {
  id: string
  type: string
  price: number
  venue_id: string
  max_players?: number
}

async function triggerPayments(sessionId: string, slot: SlotForPayment) {
  // Use service-role client so RLS doesn't block reading other players'
  // payment info, updating session status, or inserting the booking row.
  const serviceSupabase = createServiceClient()

  // Get venue stripe account — may be absent during testing before Connect is configured
  const { data: venue } = await serviceSupabase
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

  // Get all players who have a payment method (up to capacity)
  const capacity = slot.max_players ?? 10
  const { data: players } = await serviceSupabase
    .from('players')
    .select('id, stripe_customer_id, stripe_payment_method_id, name')
    .eq('session_id', sessionId)
    .not('stripe_payment_method_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .limit(capacity)

  if (!players || players.length === 0) {
    console.error('No players with payment methods found for session', sessionId)
    return
  }

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
        // Only add Connect params when the venue has a Stripe account configured.
        // Without them, the charge goes directly to the platform account (test fallback).
        ...(venueStripeAccountId ? {
          application_fee_amount: PLATFORM_FEE_PENCE,
          transfer_data: { destination: venueStripeAccountId },
        } : {}),
        metadata: { session_id: sessionId, player_id: player.id },
      })
    })
  )

  const allSucceeded = results.every(
    r => r.status === 'fulfilled' && (r.value as { status: string }).status === 'succeeded'
  )

  if (allSucceeded) {
    await serviceSupabase
      .from('sessions')
      .update({ status: 'confirmed' })
      .eq('id', sessionId)

    await serviceSupabase
      .from('bookings')
      .insert({
        session_id: sessionId,
        slot_id: slot.id,
        confirmed_at: new Date().toISOString(),
      })
  } else {
    const failures = results.filter(r => r.status === 'rejected')
    console.error(`${failures.length} payment(s) failed for session ${sessionId}`)
    // TODO: notify failed players to retry
  }
}
