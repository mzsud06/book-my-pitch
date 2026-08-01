import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLATFORM_FEE_PENCE, STRIPE_PROCESSING_PENCE } from '@/lib/stripe'
import { combineSlots } from '@/lib/slots'

export interface SlotForPayment {
  id: string
  price: number
  venue_id: string
  pitches: { max_players: number }
}

export interface TriggerPaymentsResult {
  ok: boolean
  failedPlayerIds?: string[]
}

const FREED_SPOT_MESSAGE = 'Your payment failed for a game you joined, your spot has been freed up. Rejoin with a working card to secure your place.'

function formatNameList(names: string[]): string {
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// Guests (allowed on private games) have no account, so the standard
// per-player notification never reaches them — the organiser is the one
// person guaranteed to have an account, and on a private game these are
// almost always friends the organiser can just message directly. `failed`
// excludes the organiser's own row (they already get their own notification
// via the caller's failedPlayersToNotify/toNotify pass) — a no-op if that
// leaves nobody to report.
async function notifyOrganiserOfFailure(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  sessionId: string,
  organiserId: string | null,
  failed: { name: string; user_id: string | null }[],
): Promise<void> {
  if (!organiserId) return
  const others = failed.filter(p => p.user_id !== organiserId)
  if (others.length === 0) return

  await serviceSupabase.from('notifications').insert({
    user_id: organiserId,
    session_id: sessionId,
    message: `${formatNameList(others.map(p => p.name))}'s payment didn't go through, so the game hasn't filled. If they joined as a guest they won't see this, worth messaging them directly to rejoin with a working card.`,
  })
}

// Shared by /api/join (fires when the joining player's own request happens to
// fill the last spot) and /api/trigger-payments (internal/cron retrigger).
//
// Two-phase charge: authorize every player's card as an uncaptured hold first
// (capture_method: 'manual'), then either capture all of them (only if every
// authorization succeeded) or cancel all of them (if any failed). Cancelling
// an uncaptured hold costs nothing — no Stripe processing fee — whereas
// refunding a completed charge keeps the fee. Authorizing the whole group
// before capturing anyone means a single declined card no longer costs a fee
// on every other player's successful charge.
export async function triggerPayments(sessionId: string, slot: SlotForPayment, slotIds: string[]): Promise<TriggerPaymentsResult> {
  const serviceSupabase = createServiceClient()

  // Short-circuit if already confirmed, cancelled, or expired to avoid
  // double-charging (and to avoid authorizing cards for a game whose time
  // has already passed, e.g. a retry job firing late).
  const { data: sessionRow } = await serviceSupabase
    .from('sessions')
    .select('id, status, organiser_id')
    .eq('id', sessionId)
    .single()
  if (!sessionRow || sessionRow.status === 'confirmed' || sessionRow.status === 'cancelled' || sessionRow.status === 'expired') return { ok: true }
  const organiserId: string | null = sessionRow.organiser_id

  const { data: venue } = await serviceSupabase
    .from('venues')
    .select('name, stripe_account_id, stripe_onboarding_complete, admin_approved')
    .eq('id', slot.venue_id)
    .single()

  // A venue can have a stripe_account_id long before Stripe has actually
  // verified it (identity, bank details) — attempting a transfer_data
  // charge against an unverified account fails for every player in the
  // group at once. Only use it once onboarding is confirmed complete
  // (see app/owner/dashboard/page.tsx, which flips this flag once Stripe
  // reports charges_enabled); otherwise fall back exactly as if the venue
  // had no connected account at all.
  //
  // admin_approved is a second, independent gate — Stripe verifies the
  // OWNER's identity, not that the venue itself is real. /api/sessions
  // already refuses to create a session for an unapproved venue, but this
  // is the last line of defense: never transfer real money to one even if
  // a session somehow exists (e.g. approval was revoked after creation).
  const venueStripeAccountId: string | null =
    venue?.stripe_account_id && venue?.stripe_onboarding_complete && venue?.admin_approved
      ? venue.stripe_account_id
      : null
  if (!venueStripeAccountId) {
    console.warn('Venue has no verified stripe_account_id — charging directly to platform account (test mode fallback)')
  }

  // Multi-hour (60/120/180 min) bookings span several slot rows — combine
  // them for the true total price charged.
  const { data: allSlotRows } = await serviceSupabase
    .from('slots')
    .select('*, pitches(*)')
    .in('id', slotIds)
  const combined = combineSlots((allSlotRows ?? [slot]) as unknown as { id: string; date: string; start_time: string; end_time: string; price: number; pitches: { id: string; name: string; format: string; surface: string; max_players: number; peak_price: number; offpeak_price: number; weekend_price: number } }[])

  const perPlayerPitch = Math.round((combined.price * 100) / combined.pitches.max_players)
  const totalPerPlayer = perPlayerPitch + PLATFORM_FEE_PENCE + STRIPE_PROCESSING_PENCE

  const { data: players } = await serviceSupabase
    .from('players')
    .select('id, stripe_customer_id, stripe_payment_method_id, name, user_id')
    .eq('session_id', sessionId)
    .not('stripe_payment_method_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .limit(slot.pitches.max_players)

  const allPlayers = players ?? []
  if (allPlayers.length === 0) {
    console.error('No players with payment methods found for session', sessionId)
    return { ok: true }
  }

  // Step 1 — authorize every player's card in parallel. This is a hold, not a
  // charge: nothing is captured yet, so nothing costs a Stripe fee yet.
  const authResults = await Promise.allSettled(
    allPlayers.map(async (player) => {
      return stripe.paymentIntents.create({
        amount: totalPerPlayer,
        currency: 'gbp',
        customer: player.stripe_customer_id,
        payment_method: player.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        capture_method: 'manual',
        description: `BookMyPitch: ${venue?.name ?? 'your local pitch'} ${combined.start_time}–${combined.end_time} ${combined.date}`,
        ...(venueStripeAccountId ? {
          application_fee_amount: PLATFORM_FEE_PENCE,
          transfer_data: { destination: venueStripeAccountId },
        } : {}),
        metadata: { session_id: sessionId, player_id: player.id },
      })
    })
  )

  const authorizedPIIds: string[] = []
  const authFailedPlayers: typeof allPlayers = []
  authResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && (r.value as { id: string; status: string }).status === 'requires_capture') {
      authorizedPIIds.push((r.value as { id: string }).id)
    } else {
      authFailedPlayers.push(allPlayers[i])
    }
  })

  if (authFailedPlayers.length > 0) {
    // One or more cards failed to authorize (declined, insufficient funds,
    // requires 3DS step-up we can't complete off-session, etc). Cancel the
    // holds that DID authorize — free, since nothing was captured — so no one
    // is charged for a game that never confirmed.
    if (authorizedPIIds.length > 0) {
      const cancelResults = await Promise.allSettled(authorizedPIIds.map(id => stripe.paymentIntents.cancel(id)))
      const cancelFailures = cancelResults.filter(r => r.status === 'rejected')
      if (cancelFailures.length > 0) {
        Sentry.captureException(new Error(`Failed to cancel ${cancelFailures.length} authorization(s) after partial failure for session ${sessionId}`), {
          tags: { module: 'triggerPayments', step: 'cancel_after_auth_failure' },
          extra: { session_id: sessionId },
        })
      }
    }

    const failedPlayerIds = authFailedPlayers.map(p => p.id)
    await serviceSupabase.from('players').delete().in('id', failedPlayerIds)

    const failedPlayersToNotify = authFailedPlayers.filter(p => p.user_id)
    if (failedPlayersToNotify.length > 0) {
      await serviceSupabase.from('notifications').insert(
        failedPlayersToNotify.map(p => ({
          user_id: p.user_id as string,
          session_id: sessionId,
          message: FREED_SPOT_MESSAGE,
        }))
      )
    }
    await notifyOrganiserOfFailure(serviceSupabase, sessionId, organiserId, authFailedPlayers)

    Sentry.captureException(
      new Error(`${failedPlayerIds.length}/${allPlayers.length} card(s) failed to authorize for session ${sessionId}`),
      {
        tags: { module: 'triggerPayments', step: 'authorize', session_id: sessionId },
        extra: { session_id: sessionId, failure_count: failedPlayerIds.length, total_players: allPlayers.length },
      },
    )
    console.error(`${failedPlayerIds.length} card(s) failed to authorize for session ${sessionId} — cancelled ${authorizedPIIds.length} hold(s), removed ${failedPlayerIds.length} failed player(s)`)
    return { ok: false, failedPlayerIds }
  }

  // Step 2 — everyone authorized. Capture all of them: this is the only point
  // money actually moves, and the only point a Stripe fee is incurred.
  const captureResults = await Promise.allSettled(authorizedPIIds.map(id => stripe.paymentIntents.capture(id)))
  const captureFailedIdxs = new Set<number>()
  captureResults.forEach((r, i) => { if (r.status === 'rejected') captureFailedIdxs.add(i) })

  if (captureFailedIdxs.size > 0) {
    // Extremely rare — a card that authorized moments earlier fails at
    // capture (e.g. revoked mid-flight). Whichever ones DID get captured are
    // now genuinely charged, so refund those (fee unavoidable there); the
    // rest never captured, so nothing to refund for them.
    const capturedPIIds = authorizedPIIds.filter((_, i) => !captureFailedIdxs.has(i))
    const captureFailedPlayers = allPlayers.filter((_, i) => captureFailedIdxs.has(i))

    if (capturedPIIds.length > 0) {
      const refundResults = await Promise.allSettled(capturedPIIds.map(id => stripe.refunds.create({ payment_intent: id })))
      const refundFailures = refundResults.filter(r => r.status === 'rejected')
      if (refundFailures.length > 0) {
        Sentry.captureException(new Error(`Failed to refund ${refundFailures.length} captured payment(s) after partial capture failure for session ${sessionId}`), {
          tags: { module: 'triggerPayments', step: 'refund_after_capture_failure' },
          extra: { session_id: sessionId },
        })
      }
    }

    const captureFailedPlayerIds = captureFailedPlayers.map(p => p.id)
    await serviceSupabase.from('players').delete().in('id', captureFailedPlayerIds)

    const toNotify = captureFailedPlayers.filter(p => p.user_id)
    if (toNotify.length > 0) {
      await serviceSupabase.from('notifications').insert(
        toNotify.map(p => ({
          user_id: p.user_id as string,
          session_id: sessionId,
          message: FREED_SPOT_MESSAGE,
        }))
      )
    }
    await notifyOrganiserOfFailure(serviceSupabase, sessionId, organiserId, captureFailedPlayers)

    Sentry.captureException(
      new Error(`${captureFailedIdxs.size}/${authorizedPIIds.length} capture(s) failed after successful authorization for session ${sessionId}`),
      {
        tags: { module: 'triggerPayments', step: 'capture', session_id: sessionId },
        extra: { session_id: sessionId, failure_count: captureFailedIdxs.size, total_players: allPlayers.length },
      },
    )
    return { ok: false, failedPlayerIds: captureFailedPlayerIds }
  }

  // Full success — every player captured.
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
      tags: { module: 'triggerPayments', step: 'cancel_rivals' },
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
          message: 'Another group confirmed this slot, your game has been cancelled. No charge was made.',
        }))
      )
    }
  }

  return { ok: true }
}
