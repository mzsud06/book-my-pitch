import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { slotId, sessionId, isOrganiser, name, phone, paymentMethodId, customerId } = body

    // Validate UUIDs
    if (!isValidUUID(slotId) || !isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Validate Stripe IDs — must start with expected prefixes
    if (typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }
    if (typeof customerId !== 'string' || !customerId.startsWith('cus_')) {
      return NextResponse.json({ error: 'Invalid customer' }, { status: 400 })
    }

    // Server-side input validation (client also validates, but always re-validate server-side)
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || trimmedName.length > 100 || !/^[A-Za-z\s'-]+$/.test(trimmedName)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : null
    if (trimmedPhone && !/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const supabase = await createClient()
    const serviceSupabase = createServiceClient()

    // Get authenticated user (optional — guests allowed)
    const { data: { user } } = await supabase.auth.getUser()

    // Verify from Stripe that the payment method belongs to the claimed customer.
    // This prevents a client substituting another user's customerId in the request body.
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id
    if (!pmCustomer || pmCustomer !== customerId) {
      return NextResponse.json({ error: 'Invalid payment details' }, { status: 400 })
    }

    // Get slot info — use anon client so RLS applies (slot must be publicly readable)
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .single()

    if (slotError || !slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    // Verify session exists and is still filling — use service client to avoid RLS timing issues
    const { data: existingSession } = await serviceSupabase
      .from('sessions')
      .select('id, status, organiser_id, matched_session_id')
      .eq('id', sessionId)
      .single()

    if (!existingSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (existingSession.status !== 'filling') {
      return NextResponse.json({ error: 'Session is no longer accepting players' }, { status: 400 })
    }

    // Duplicate-join guard — run before touching any Stripe resources.
    if (user?.id) {
      const { data: alreadyIn } = await serviceSupabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (alreadyIn) {
        return NextResponse.json({ error: "You're already in this game" }, { status: 409 })
      }
    } else if (trimmedPhone) {
      const { data: alreadyIn } = await serviceSupabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('phone', trimmedPhone)
        .maybeSingle()
      if (alreadyIn) {
        return NextResponse.json({ error: "You're already in this game" }, { status: 409 })
      }
    }

    // Check the session hasn't already hit capacity before inserting
    const { count: currentCount } = await serviceSupabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    const capacity: number = (slot as unknown as { max_players?: number }).max_players ?? 10
    const sessionMatchedIdEarly = (existingSession as unknown as { matched_session_id: string | null }).matched_session_id
    const joinCap = sessionMatchedIdEarly ? 5 : capacity
    if ((currentCount ?? 0) >= joinCap) {
      return NextResponse.json({
        error: sessionMatchedIdEarly ? 'This team is already full.' : 'Session is full',
      }, { status: sessionMatchedIdEarly ? 400 : 409 })
    }

    // Use service-role client for the player insert — removes the requirement for
    // an overly permissive RLS INSERT policy on the players table.
    const { error: playerError } = await serviceSupabase
      .from('players')
      .insert({
        session_id: sessionId,
        user_id: user?.id ?? null,
        name: trimmedName,
        phone: trimmedPhone ?? null,
        stripe_payment_method_id: paymentMethodId,
        stripe_customer_id: customerId,
      })

    if (playerError) {
      console.error('Player insert error:', playerError.message)
      return NextResponse.json({ error: 'Failed to add player' }, { status: 500 })
    }

    // Count players who have provided payment details.
    const { count: payingCount } = await serviceSupabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .not('stripe_payment_method_id', 'is', null)
      .not('stripe_customer_id', 'is', null)

    const playerCount = payingCount ?? 0
    const sessionMatchedId = (existingSession as unknown as { matched_session_id: string | null }).matched_session_id

    if (sessionMatchedId) {
      if (playerCount >= 5) {
        const { count: matchedCount } = await serviceSupabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionMatchedId)
          .not('stripe_payment_method_id', 'is', null)
          .not('stripe_customer_id', 'is', null)
        if ((matchedCount ?? 0) >= 5) {
          await triggerPayments(sessionId, slot as unknown as SlotForPayment)
          await triggerPayments(sessionMatchedId, slot as unknown as SlotForPayment)
        }
      }
    } else if (playerCount >= capacity) {
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
  const serviceSupabase = createServiceClient()

  // Short-circuit if already confirmed (e.g. the partner session's trigger call got here first)
  const { data: sessionRow } = await serviceSupabase
    .from('sessions')
    .select('id, status, matched_session_id')
    .eq('id', sessionId)
    .single()
  if (!sessionRow || sessionRow.status === 'confirmed') return

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

  const matchedId: string | null = (sessionRow as unknown as { matched_session_id: string | null }).matched_session_id
  const perSessionLimit = matchedId ? 5 : (slot.max_players ?? 10)

  const { data: players } = await serviceSupabase
    .from('players')
    .select('id, stripe_customer_id, stripe_payment_method_id, name')
    .eq('session_id', sessionId)
    .not('stripe_payment_method_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .limit(perSessionLimit)

  let matchedPlayers: { id: string; stripe_customer_id: string; stripe_payment_method_id: string; name: string }[] = []
  if (matchedId) {
    const { data: mp } = await serviceSupabase
      .from('players')
      .select('id, stripe_customer_id, stripe_payment_method_id, name')
      .eq('session_id', matchedId)
      .not('stripe_payment_method_id', 'is', null)
      .not('stripe_customer_id', 'is', null)
      .limit(5)
    matchedPlayers = (mp ?? []) as typeof matchedPlayers
  }

  const allPlayers = [...(players ?? []), ...matchedPlayers]
  if (allPlayers.length === 0) {
    console.error('No players with payment methods found for session', sessionId)
    return
  }

  const results = await Promise.allSettled(
    allPlayers.map(async (player: { id: string; stripe_customer_id: string; stripe_payment_method_id: string; name: string }) => {
      return stripe.paymentIntents.create({
        amount: totalPerPlayer,
        currency: 'gbp',
        customer: player.stripe_customer_id,
        payment_method: player.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `BookMyPitch — Globe Pitch ${slot.type} slot`,
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
    const sessionIds = matchedId ? [sessionId, matchedId] : [sessionId]
    await Promise.all(
      sessionIds.map(sid =>
        serviceSupabase.from('sessions').update({ status: 'confirmed' }).eq('id', sid)
      )
    )
    await Promise.all(
      sessionIds.map(sid =>
        serviceSupabase.from('bookings').insert({
          session_id: sid,
          slot_id: slot.id,
          confirmed_at: new Date().toISOString(),
        })
      )
    )
  } else {
    const failures = results.filter(r => r.status === 'rejected')
    console.error(`${failures.length} payment(s) failed for session ${sessionId}`)
  }
}
