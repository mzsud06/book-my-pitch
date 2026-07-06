import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'
import { combineSlots } from '@/lib/slots'

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch — compare lengths first (not
  // secret-dependent timing, since length alone isn't sensitive here).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export async function POST(req: NextRequest) {
  // Explicitly require INTERNAL_SECRET to be configured and non-empty.
  // An unset or empty secret must never grant access.
  const internalSecret = process.env.INTERNAL_SECRET
  if (!internalSecret) {
    console.error('INTERNAL_SECRET is not configured — trigger-payments endpoint is disabled')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providedSecret = req.headers.get('x-internal-secret')
  if (!providedSecret || !secretsMatch(providedSecret, internalSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let sessionId: string | undefined
  try {
    const body = await req.json()
    sessionId = body.sessionId

    if (!isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }

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
    const sessionSlotIds: string[] = (session.slot_ids && session.slot_ids.length > 0) ? session.slot_ids : [slot.id]

    // Multi-hour (60/120/180 min) bookings span several slot rows — combine
    // them for the true total price and time range charged/locked.
    const { data: allSlotRows } = await supabase
      .from('slots')
      .select('*')
      .in('id', sessionSlotIds)
    const combined = combineSlots((allSlotRows ?? [slot]) as unknown as { id: string; date: string; start_time: string; end_time: string; price: number; max_players: number }[])

    const { data: venue } = await supabase
      .from('venues')
      .select('stripe_account_id')
      .eq('id', slot.venue_id)
      .single()

    const venueStripeAccountId: string | null = venue?.stripe_account_id ?? null
    if (!venueStripeAccountId) {
      console.warn('Venue has no stripe_account_id — charging directly to platform account (test mode fallback)')
    }

    const perPlayerPitch = Math.round((combined.price * 100) / 10)
    const totalPerPlayer = perPlayerPitch + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE

    const matchedSessionId: string | null = (session as unknown as { matched_session_id: string | null }).matched_session_id
    const isMatchedGame = !!matchedSessionId
    const perSessionLimit = isMatchedGame ? 5 : (slot.max_players ?? 10)
    const expectedTotal = isMatchedGame ? 10 : (slot.max_players ?? 10)

    const { data: players } = await supabase
      .from('players')
      .select('id, stripe_customer_id, stripe_payment_method_id, name')
      .eq('session_id', sessionId)
      .not('stripe_payment_method_id', 'is', null)
      .not('stripe_customer_id', 'is', null)
      .limit(perSessionLimit)

    let matchedPlayers: { id: string; stripe_customer_id: string; stripe_payment_method_id: string; name: string }[] = []
    if (isMatchedGame && matchedSessionId) {
      const { data: mp } = await supabase
        .from('players')
        .select('id, stripe_customer_id, stripe_payment_method_id, name')
        .eq('session_id', matchedSessionId)
        .not('stripe_payment_method_id', 'is', null)
        .not('stripe_customer_id', 'is', null)
        .limit(5)
      matchedPlayers = (mp ?? []) as typeof matchedPlayers
    }

    const allPlayers = [...(players ?? []), ...matchedPlayers]

    if (allPlayers.length < expectedTotal) {
      return NextResponse.json({ error: 'Not enough players' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      allPlayers.map(async (player: { id: string; stripe_customer_id: string; stripe_payment_method_id: string; name: string }) => {
        const pi = await stripe.paymentIntents.create({
          amount: totalPerPlayer,
          currency: 'gbp',
          customer: player.stripe_customer_id,
          payment_method: player.stripe_payment_method_id,
          confirm: true,
          off_session: true,
          description: `BookMyPitch — Globe Pitch ${combined.start_time}–${combined.end_time} ${combined.date}`,
          ...(venueStripeAccountId ? {
            application_fee_amount: PLATFORM_FEE_PENCE,
            transfer_data: { destination: venueStripeAccountId },
          } : {}),
          metadata: { session_id: sessionId!, player_id: player.id },
        })
        return { pi, player }
      })
    )

    const succeededPIIds: string[] = []
    const failedPlayerIds: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && (r.value as { pi: { id: string; status: string } }).pi.status === 'succeeded') {
        succeededPIIds.push((r.value as { pi: { id: string; status: string } }).pi.id)
      } else {
        failedPlayerIds.push(allPlayers[i].id)
      }
    })

    if (failedPlayerIds.length === 0) {
      const sessionIds = isMatchedGame ? [sessionId, matchedSessionId!] : [sessionId]
      await Promise.all(
        sessionIds.map(sid => supabase.from('sessions').update({ status: 'confirmed' }).eq('id', sid))
      )
      // One booking row per locked slot (a multi-hour booking locks several).
      await Promise.all(
        sessionIds.flatMap(sid => sessionSlotIds.map(sid2 => supabase.from('bookings').insert({
          session_id: sid,
          slot_id: sid2,
          confirmed_at: new Date().toISOString(),
        })))
      )

      // These slots are now taken — cancel any other groups still competing for
      // any of them, whether as their primary slot_id or elsewhere in their
      // own multi-hour slot_ids array.
      const [{ error: cancelRivalsByPrimaryError }, { error: cancelRivalsByArrayError }] = await Promise.all([
        supabase
          .from('sessions')
          .update({ status: 'cancelled' })
          .in('slot_id', sessionSlotIds)
          .eq('status', 'filling')
          .not('id', 'in', `(${sessionIds.join(',')})`),
        supabase
          .from('sessions')
          .update({ status: 'cancelled' })
          .overlaps('slot_ids', sessionSlotIds)
          .eq('status', 'filling')
          .not('id', 'in', `(${sessionIds.join(',')})`),
      ])

      if (cancelRivalsByPrimaryError || cancelRivalsByArrayError) {
        Sentry.captureException(new Error('Failed to cancel rival sessions after confirmation'), {
          tags: { route: 'POST /api/trigger-payments', step: 'cancel_rivals' },
          extra: {
            session_id: sessionId,
            slot_ids: sessionSlotIds,
            error: cancelRivalsByPrimaryError?.message ?? cancelRivalsByArrayError?.message,
          },
        })
      }

      return NextResponse.json({ success: true, message: 'All payments succeeded, session confirmed' })
    } else {
      // One or more payments failed — refund everyone who did succeed so nobody
      // is charged for a game that never confirmed, and drop the failed
      // player(s) so their spot reopens for a retry with a working card.
      if (succeededPIIds.length > 0) {
        const refundResults = await Promise.allSettled(
          succeededPIIds.map(piId => stripe.refunds.create({ payment_intent: piId }))
        )
        const refundFailures = refundResults.filter(r => r.status === 'rejected')
        if (refundFailures.length > 0) {
          Sentry.captureException(new Error(`Failed to refund ${refundFailures.length} successful payment(s) after partial failure for session ${sessionId}`), {
            tags: { route: 'POST /api/trigger-payments', step: 'refund_after_failure' },
            extra: { session_id: sessionId },
          })
        }
      }

      await supabase.from('players').delete().in('id', failedPlayerIds)

      // Session status is left as 'filling' — it was never marked confirmed
      // above, so no update is needed here. The failed player's spot is now
      // open again and the next join attempt will re-trigger payment collection.

      Sentry.captureException(
        new Error(`${failedPlayerIds.length}/${allPlayers.length} payment(s) failed for session ${sessionId}`),
        {
          tags: { route: 'POST /api/trigger-payments', session_id: sessionId },
          extra: {
            session_id: sessionId,
            matched_session_id: matchedSessionId,
            is_matched_game: isMatchedGame,
            total_players: allPlayers.length,
            failure_count: failedPlayerIds.length,
            refunded_count: succeededPIIds.length,
          },
        },
      )
      console.error(`${failedPlayerIds.length} payment(s) failed for session ${sessionId} — refunded ${succeededPIIds.length} successful payment(s), removed ${failedPlayerIds.length} failed player(s)`)
      return NextResponse.json({
        success: false,
        message: 'Some payments failed. Successful charges have been refunded and affected players removed so they can rejoin with a working card.',
      }, { status: 422 })
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'POST /api/trigger-payments' },
      extra: { session_id: sessionId ?? null },
    })
    console.error('trigger-payments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
