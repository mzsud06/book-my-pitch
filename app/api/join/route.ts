import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { combineSlots } from '@/lib/slots'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

function redactPhone(phone: unknown): string {
  if (typeof phone !== 'string' || phone.length === 0) return '(none)'
  return `${phone.slice(0, 3)}****`
}

function redactStripeId(id: unknown): string {
  if (typeof id !== 'string' || id.length === 0) return '(none)'
  return `${id.slice(0, 6)}...`
}

const RATE_LIMIT_MAX = 50
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`join:${getClientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { slotId, sessionId, isOrganiser, name, phone, paymentMethodId, customerId } = body

    console.log('[join] POST body received:', JSON.stringify({
      slotId,
      sessionId,
      isOrganiser,
      name: typeof name === 'string' ? `${name.slice(0, 1)}***` : name,
      phone: redactPhone(phone),
      paymentMethodId: redactStripeId(paymentMethodId),
      customerId: redactStripeId(customerId),
    }))

    // Validate UUIDs
    if (!isValidUUID(slotId) || !isValidUUID(sessionId)) {
      console.warn('[join] 400 uuid-check: slotId valid=', isValidUUID(slotId), 'sessionId valid=', isValidUUID(sessionId))
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Validate Stripe IDs — must start with expected prefixes
    if (typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
      console.warn('[join] 400 paymentMethodId failed: type=', typeof paymentMethodId, 'value=', redactStripeId(paymentMethodId))
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }
    if (typeof customerId !== 'string' || !customerId.startsWith('cus_')) {
      console.warn('[join] 400 customerId failed: type=', typeof customerId, 'value=', redactStripeId(customerId))
      return NextResponse.json({ error: 'Invalid customer' }, { status: 400 })
    }

    // Server-side input validation (client also validates, but always re-validate server-side)
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || trimmedName.length > 100 || !/^[A-Za-z\s'-]+$/.test(trimmedName)) {
      console.warn('[join] 400 name failed: length=', trimmedName.length)
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : null
    if (trimmedPhone && !/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      console.warn('[join] 400 phone failed: trimmedPhone=', redactPhone(trimmedPhone))
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
      console.warn('[join] 400 stripe-ownership: pm.customer=', redactStripeId(pmCustomer), 'claimed customerId=', redactStripeId(customerId))
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
      .select('id, status, organiser_id, game_type, slot_ids')
      .eq('id', sessionId)
      .single()

    if (!existingSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (existingSession.status !== 'filling') {
      console.warn('[join] 400 session-status: sessionId=', sessionId, 'status=', existingSession.status)
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
    const sessionGameType = (existingSession as unknown as { game_type: string | null }).game_type
    const organiserId = (existingSession as unknown as { organiser_id: string | null }).organiser_id

    // Open games require an authenticated user — block guests at the API level too.
    if (sessionGameType === 'open' && !user) {
      return NextResponse.json({ error: 'You must be logged in to join an open game.' }, { status: 401 })
    }

    let joinCap = capacity

    // Reserve one slot for the organiser if they haven't paid yet so they can't
    // be locked out by non-organisers filling all 10 spots first.
    if (organiserId && user?.id !== organiserId) {
      const { count: organiserRowCount } = await serviceSupabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('user_id', organiserId)
      if ((organiserRowCount ?? 0) === 0) {
        joinCap = capacity - 1
      }
    }

    if ((currentCount ?? 0) >= joinCap) {
      console.warn('[join] 409 capacity: currentCount=', currentCount, 'joinCap=', joinCap)
      return NextResponse.json({ error: 'Session is full' }, { status: 409 })
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
      Sentry.captureException(new Error(playerError.message), {
        tags: { route: 'POST /api/join', step: 'player_insert' },
        extra: { session_id: sessionId, slot_id: slotId },
      })
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

    // Notify everyone else already in the session (excluding the player who
    // just joined) that a new player has arrived.
    const { data: sessionPlayers } = await serviceSupabase
      .from('players')
      .select('user_id')
      .eq('session_id', sessionId)
      .not('user_id', 'is', null)
    const otherUserIds = (sessionPlayers as unknown as { user_id: string }[] ?? [])
      .map(p => p.user_id)
      .filter(uid => uid !== (user?.id ?? null))
    if (otherUserIds.length > 0) {
      await serviceSupabase.from('notifications').insert(
        otherUserIds.map(uid => ({
          user_id: uid,
          session_id: sessionId,
          message: `${trimmedName} just joined your game — ${playerCount}/${capacity} players now.`,
        }))
      )
    }

    // One-off nudge to the organiser once the session is one player away from full.
    if (organiserId && playerCount === capacity - 1) {
      await serviceSupabase.from('notifications').insert({
        user_id: organiserId,
        session_id: sessionId,
        message: 'Your game is almost full — one more player needed to confirm!',
      })
    }

    // Multi-hour (60/120/180 min) bookings store the full consecutive slot list here.
    const existingSessionSlotIds = (existingSession as unknown as { slot_ids: string[] | null }).slot_ids
    const sessionSlotIds: string[] = existingSessionSlotIds && existingSessionSlotIds.length > 0 ? existingSessionSlotIds : [slot.id]

    // Set when the triggered payment batch below fails for one or more players —
    // checked just before the final success response so the joining player
    // (who is always part of that batch) hears about it instead of getting a
    // silent 200.
    let paymentFailure = false

    if (playerCount >= capacity) {
      // Session just reached capacity — trigger payment collection.
      let organiserReady = true
      if (organiserId) {
        const { count: organiserPaidCount } = await serviceSupabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId)
          .eq('user_id', organiserId)
          .not('stripe_payment_method_id', 'is', null)
        organiserReady = (organiserPaidCount ?? 0) > 0
      }
      if (organiserReady) {
        const r = await triggerPayments(sessionId, slot as unknown as SlotForPayment, sessionSlotIds)
        if (!r.ok) paymentFailure = true
      }
    }

    if (paymentFailure) {
      return NextResponse.json({
        error: 'A payment failed for one of the players. No one has been charged and all payments have been refunded. Their spot has been freed up — once they rejoin with a working card the game will confirm.',
      }, { status: 402 })
    }

    return NextResponse.json({ sessionId, playerCount })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'POST /api/join' },
    })
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

async function triggerPayments(sessionId: string, slot: SlotForPayment, slotIds: string[]): Promise<{ ok: boolean }> {
  const serviceSupabase = createServiceClient()

  // Short-circuit if already confirmed or cancelled to avoid double-charging.
  const { data: sessionRow } = await serviceSupabase
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .single()
  if (!sessionRow || sessionRow.status === 'confirmed' || sessionRow.status === 'cancelled') return { ok: true }

  const { data: venue } = await serviceSupabase
    .from('venues')
    .select('name, stripe_account_id')
    .eq('id', slot.venue_id)
    .single()

  const venueStripeAccountId: string | null = venue?.stripe_account_id ?? null
  if (!venueStripeAccountId) {
    console.warn('Venue has no stripe_account_id — charging directly to platform account (test mode fallback)')
  }

  // Multi-hour (60/120/180 min) bookings span several slot rows — combine
  // them for the true total price charged.
  const { data: allSlotRows } = await serviceSupabase
    .from('slots')
    .select('*')
    .in('id', slotIds)
  const combined = combineSlots((allSlotRows ?? [slot]) as unknown as { id: string; date: string; start_time: string; end_time: string; price: number; max_players: number }[])

  const perPlayerPitch = Math.round((combined.price * 100) / 10)
  const totalPerPlayer = perPlayerPitch + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE

  const { data: players } = await serviceSupabase
    .from('players')
    .select('id, stripe_customer_id, stripe_payment_method_id, name, user_id')
    .eq('session_id', sessionId)
    .not('stripe_payment_method_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .limit(slot.max_players ?? 10)

  const allPlayers = players ?? []
  if (allPlayers.length === 0) {
    console.error('No players with payment methods found for session', sessionId)
    return { ok: true }
  }

  const results = await Promise.allSettled(
    allPlayers.map(async (player) => {
      return stripe.paymentIntents.create({
        amount: totalPerPlayer,
        currency: 'gbp',
        customer: player.stripe_customer_id,
        payment_method: player.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `BookMyPitch — ${venue?.name ?? 'your local pitch'} ${combined.start_time}–${combined.end_time} ${combined.date}`,
        ...(venueStripeAccountId ? {
          application_fee_amount: PLATFORM_FEE_PENCE,
          transfer_data: { destination: venueStripeAccountId },
        } : {}),
        metadata: { session_id: sessionId, player_id: player.id },
      })
    })
  )

  const succeededPIIds: string[] = []
  const failedPlayers: typeof allPlayers = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && (r.value as { id: string; status: string }).status === 'succeeded') {
      succeededPIIds.push((r.value as { id: string; status: string }).id)
    } else {
      failedPlayers.push(allPlayers[i])
    }
  })
  const failedPlayerIds = failedPlayers.map(p => p.id)

  if (failedPlayerIds.length === 0) {
    await serviceSupabase.from('sessions').update({ status: 'confirmed' }).eq('id', sessionId)
    // One booking row per locked slot (a multi-hour booking locks several).
    await Promise.all(
      slotIds.map(sid2 =>
        serviceSupabase.from('bookings').insert({
          session_id: sessionId,
          slot_id: sid2,
          confirmed_at: new Date().toISOString(),
        })
      )
    )

    // Notify every player with an account that the game is confirmed.
    const playersToNotify = allPlayers.filter(p => p.user_id)
    if (playersToNotify.length > 0) {
      await serviceSupabase.from('notifications').insert(
        playersToNotify.map(p => ({
          user_id: p.user_id as string,
          session_id: sessionId,
          message: 'Your game is confirmed! See you on the pitch.',
        }))
      )
    }

    // These slots are now taken — cancel any other groups still competing for
    // any of them, whether as their primary slot_id or elsewhere in their own
    // multi-hour slot_ids array.
    const [
      { data: cancelledByPrimary, error: cancelRivalsByPrimaryError },
      { data: cancelledByArray, error: cancelRivalsByArrayError },
    ] = await Promise.all([
      serviceSupabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .in('slot_id', slotIds)
        .eq('status', 'filling')
        .neq('id', sessionId)
        .select('id'),
      serviceSupabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .overlaps('slot_ids', slotIds)
        .eq('status', 'filling')
        .neq('id', sessionId)
        .select('id'),
    ])

    if (cancelRivalsByPrimaryError || cancelRivalsByArrayError) {
      Sentry.captureException(new Error('Failed to cancel rival sessions after confirmation'), {
        tags: { route: 'POST /api/join', step: 'cancel_rivals' },
        extra: {
          session_id: sessionId,
          slot_ids: slotIds,
          error: cancelRivalsByPrimaryError?.message ?? cancelRivalsByArrayError?.message,
        },
      })
    }

    // Notify players of the rival sessions that just got cancelled because
    // this group confirmed the slot first.
    const cancelledRivalIds = Array.from(new Set([
      ...((cancelledByPrimary ?? []) as { id: string }[]).map(r => r.id),
      ...((cancelledByArray ?? []) as { id: string }[]).map(r => r.id),
    ]))
    if (cancelledRivalIds.length > 0) {
      const { data: rivalPlayers } = await serviceSupabase
        .from('players')
        .select('user_id, session_id')
        .in('session_id', cancelledRivalIds)
        .not('user_id', 'is', null)

      if (rivalPlayers && rivalPlayers.length > 0) {
        await serviceSupabase.from('notifications').insert(
          (rivalPlayers as unknown as { user_id: string; session_id: string }[]).map(p => ({
            user_id: p.user_id,
            session_id: p.session_id,
            message: 'Another group confirmed this slot — your game has been cancelled. No charge was made.',
          }))
        )
      }
    }

    return { ok: true }
  }

  // One or more payments failed — refund everyone who did succeed so nobody is
  // charged for a game that never confirmed, and drop the failed player(s) so
  // their spot reopens for a retry with a working card.
  if (succeededPIIds.length > 0) {
    const refundResults = await Promise.allSettled(
      succeededPIIds.map(piId => stripe.refunds.create({ payment_intent: piId }))
    )
    const refundFailures = refundResults.filter(r => r.status === 'rejected')
    if (refundFailures.length > 0) {
      Sentry.captureException(new Error(`Failed to refund ${refundFailures.length} successful payment(s) after partial failure for session ${sessionId}`), {
        tags: { route: 'POST /api/join', step: 'refund_after_failure' },
        extra: { session_id: sessionId },
      })
    }
  }

  await serviceSupabase.from('players').delete().in('id', failedPlayerIds)

  // Notify any failed player who has an account that their spot was freed up.
  const failedPlayersToNotify = failedPlayers.filter(p => p.user_id)
  if (failedPlayersToNotify.length > 0) {
    await serviceSupabase.from('notifications').insert(
      failedPlayersToNotify.map(p => ({
        user_id: p.user_id as string,
        session_id: sessionId,
        message: 'Your payment failed for a game you joined — your spot has been freed up. Rejoin with a working card to secure your place.',
      }))
    )
  }

  // Session status is left as 'filling' — it was never marked confirmed above,
  // so no update is needed here. The failed player's spot is now open again
  // and the next join attempt will re-trigger payment collection.

  Sentry.captureException(
    new Error(`${failedPlayerIds.length}/${allPlayers.length} payment(s) failed for session ${sessionId}`),
    {
      tags: { route: 'POST /api/join', step: 'trigger_payments', session_id: sessionId },
      extra: {
        session_id: sessionId,
        failure_count: failedPlayerIds.length,
        total_players: allPlayers.length,
        refunded_count: succeededPIIds.length,
      },
    },
  )
  console.error(`${failedPlayerIds.length} payment(s) failed for session ${sessionId} — refunded ${succeededPIIds.length} successful payment(s), removed ${failedPlayerIds.length} failed player(s)`)
  return { ok: false }
}
