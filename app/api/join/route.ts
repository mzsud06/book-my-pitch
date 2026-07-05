import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

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
      .select('id, status, organiser_id, matched_session_id, game_type')
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
    const sessionMatchedIdEarly = (existingSession as unknown as { matched_session_id: string | null }).matched_session_id
    const sessionGameType = (existingSession as unknown as { game_type: string | null }).game_type
    const organiserId = (existingSession as unknown as { organiser_id: string | null }).organiser_id

    // Open games require an authenticated user — block guests at the API level too.
    if (sessionGameType === 'open' && !user) {
      return NextResponse.json({ error: 'You must be logged in to join an open game.' }, { status: 401 })
    }

    // Team sessions (LFO or challenger) are always capped at 5 per side.
    // Open/private 10-player sessions use the slot's full max_players capacity.
    const isTeamSession = !!sessionMatchedIdEarly || sessionGameType === 'looking_for_opposition'
    let joinCap = isTeamSession ? 5 : capacity

    // For non-team sessions: reserve one slot for the organiser if they haven't paid yet
    // so they can't be locked out by non-organisers filling all 10 spots first.
    if (!isTeamSession && organiserId && user?.id !== organiserId) {
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
      console.warn('[join] 400/409 capacity: currentCount=', currentCount, 'joinCap=', joinCap, 'isTeam=', isTeamSession)
      return NextResponse.json({
        error: isTeamSession ? 'This team is already full.' : 'Session is full',
      }, { status: isTeamSession ? 400 : 409 })
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
    const sessionMatchedId = (existingSession as unknown as { matched_session_id: string | null }).matched_session_id

    if (sessionMatchedId) {
      // This session has a partner. Two scenarios:
      // (a) Challenger — matched_session_id was set at creation, pointing at the LFO.
      // (b) Original LFO — matched_session_id was set later when a challenger won the race.
      if (playerCount >= 5) {
        const { data: partnerData } = await serviceSupabase
          .from('sessions')
          .select('id, status, matched_session_id')
          .eq('id', sessionMatchedId)
          .single()
        const partner = partnerData as unknown as { id: string; status: string; matched_session_id: string | null } | null

        if (!partner || partner.status !== 'filling') {
          // Partner gone or already confirmed — we're too late.
          await serviceSupabase.from('sessions').update({ status: 'cancelled' }).eq('id', sessionId)
          return NextResponse.json({ error: 'The spot was taken. Your session has been cancelled.' }, { status: 409 })
        }

        if (partner.matched_session_id === null) {
          // We're a challenger; the LFO hasn't been claimed yet. Race to claim it atomically.
          // The WHERE ... IS NULL guard means only one concurrent UPDATE can succeed.
          const { data: claimedRows, error: claimError } = await serviceSupabase
            .from('sessions')
            .update({ matched_session_id: sessionId })
            .eq('id', sessionMatchedId)
            .is('matched_session_id', null)
            .select('id')

          if (claimError || !claimedRows || claimedRows.length === 0) {
            // Another challenger claimed it between our read and our write — we lost.
            await serviceSupabase.from('sessions').update({ status: 'cancelled' }).eq('id', sessionId)
            await serviceSupabase
              .from('sessions')
              .update({ status: 'cancelled' })
              .eq('matched_session_id', sessionMatchedId)
              .eq('status', 'filling')
              .neq('id', sessionId)
            return NextResponse.json({ error: 'Another team got there first. Your session has been cancelled.' }, { status: 409 })
          }

          // We claimed it! Cancel all other competing challengers.
          await serviceSupabase
            .from('sessions')
            .update({ status: 'cancelled' })
            .eq('matched_session_id', sessionMatchedId)
            .eq('status', 'filling')
            .neq('id', sessionId)

          // If the LFO already has 5 paying players, trigger payments for both sides now.
          const { count: lfoCount } = await serviceSupabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionMatchedId)
            .not('stripe_payment_method_id', 'is', null)
            .not('stripe_customer_id', 'is', null)
          if ((lfoCount ?? 0) >= 5) {
            await triggerPayments(sessionId, slot as unknown as SlotForPayment)
            await triggerPayments(sessionMatchedId, slot as unknown as SlotForPayment)
          }
          // If LFO isn't at 5 yet, payments fire when their 5th player joins
          // (they'll see partner.matched_session_id === sessionId → mutual-match path below).

        } else if (partner.matched_session_id === sessionId) {
          // Mutual match — partner already points back at this session (we are the confirmed
          // winner and the LFO is now filling their side). Trigger if both teams are at 5.
          const { count: partnerCount } = await serviceSupabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionMatchedId)
            .not('stripe_payment_method_id', 'is', null)
            .not('stripe_customer_id', 'is', null)
          if ((partnerCount ?? 0) >= 5) {
            await triggerPayments(sessionId, slot as unknown as SlotForPayment)
            await triggerPayments(sessionMatchedId, slot as unknown as SlotForPayment)
          }

        } else {
          // Partner's matched_session_id points at a different session — another challenger won.
          await serviceSupabase.from('sessions').update({ status: 'cancelled' }).eq('id', sessionId)
          return NextResponse.json({ error: 'Another team got there first. Your session has been cancelled.' }, { status: 409 })
        }
      }

    } else if (sessionGameType !== 'looking_for_opposition' && playerCount >= capacity) {
      // Regular 10-player open/private session — trigger when full.
      // Unclaimed LFO sessions (game_type === 'looking_for_opposition') are intentionally
      // excluded: their trigger fires when a winning challenger claims the spot.
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
        await triggerPayments(sessionId, slot as unknown as SlotForPayment)
      }
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

async function triggerPayments(sessionId: string, slot: SlotForPayment) {
  const serviceSupabase = createServiceClient()

  // Short-circuit if already confirmed or cancelled to avoid double-charging.
  const { data: sessionRow } = await serviceSupabase
    .from('sessions')
    .select('id, status, matched_session_id')
    .eq('id', sessionId)
    .single()
  if (!sessionRow || sessionRow.status === 'confirmed' || sessionRow.status === 'cancelled') return

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
    Sentry.captureException(
      new Error(`${failures.length}/${allPlayers.length} payment(s) failed for session ${sessionId}`),
      {
        tags: { route: 'POST /api/join', step: 'trigger_payments', session_id: sessionId },
        extra: { session_id: sessionId, failure_count: failures.length, total_players: allPlayers.length },
      },
    )
    console.error(`${failures.length} payment(s) failed for session ${sessionId}`)
  }
}
