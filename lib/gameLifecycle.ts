import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { CONFIRM_WINDOW_HOURS, GAME_COLS, GameRow, kickoffMs, londonToday } from '@/lib/games'

type Svc = ReturnType<typeof createServiceClient>

interface PlayerRow {
  id: string
  user_id: string | null
  name: string
  payment_intent_id: string | null
}

async function loadPlayers(svc: Svc, sessionId: string): Promise<PlayerRow[]> {
  const { data } = await svc
    .from('players')
    .select('id, user_id, name, payment_intent_id')
    .eq('session_id', sessionId)
  return (data ?? []) as PlayerRow[]
}

async function notify(svc: Svc, sessionId: string, userIds: (string | null)[], message: string) {
  const ids = Array.from(new Set(userIds.filter((u): u is string => !!u)))
  if (ids.length === 0) return
  await svc.from('notifications').insert(ids.map(user_id => ({ user_id, session_id: sessionId, message })))
}

// Releases a player's hold. Cancelling an uncaptured hold is free. Errors
// (already cancelled, expired, captured) are non-fatal.
export async function releaseHold(paymentIntentId: string | null): Promise<void> {
  if (!paymentIntentId) return
  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (err) {
    console.warn('releaseHold: could not cancel', paymentIntentId, (err as Error).message)
  }
}

// Ends a game that isn't going ahead: releases every hold, flips the status
// and tells the players. The status guard stops this racing a confirm.
export async function endGame(
  svc: Svc,
  game: Pick<GameRow, 'id' | 'organiser_id'>,
  finalStatus: 'cancelled' | 'expired',
  playerMessage: string,
  organiserMessage?: string,
): Promise<boolean> {
  const { data: updated } = await svc
    .from('sessions')
    .update({ status: finalStatus })
    .eq('id', game.id)
    .in('status', ['filling', 'full'])
    .select('id')
  if (!updated || updated.length === 0) return false

  const players = await loadPlayers(svc, game.id)
  await Promise.all(players.map(p => releaseHold(p.payment_intent_id)))
  await notify(svc, game.id, players.map(p => p.user_id).filter(u => u !== game.organiser_id), playerMessage)
  if (organiserMessage) await notify(svc, game.id, [game.organiser_id], organiserMessage)
  return true
}

export type ConfirmResult =
  | { ok: true }
  | { ok: false; error: string; reopened?: number }

// Organiser says "I've booked it": capture every hold, then mark confirmed.
// If any hold has lapsed or fails, nobody is charged: the bad players are
// removed and the game goes back to filling.
export async function confirmGame(svc: Svc, game: GameRow): Promise<ConfirmResult> {
  const players = await loadPlayers(svc, game.id)
  if (players.length === 0) return { ok: false, error: 'No players to charge' }

  // Check every hold is still live before capturing anyone.
  const checks = await Promise.all(
    players.map(async p => {
      if (!p.payment_intent_id) return { p, ok: false }
      try {
        const pi = await stripe.paymentIntents.retrieve(p.payment_intent_id)
        return { p, ok: pi.status === 'requires_capture' }
      } catch {
        return { p, ok: false }
      }
    }),
  )
  const lapsed = checks.filter(c => !c.ok).map(c => c.p)
  if (lapsed.length > 0) {
    await reopenWithout(svc, game, lapsed, players.length - lapsed.length)
    return {
      ok: false,
      error: `${lapsed.length} player${lapsed.length === 1 ? "'s" : "s'"} card hold expired, so nobody has been charged. Their spot${lapsed.length === 1 ? ' is' : 's are'} open again.`,
      reopened: lapsed.length,
    }
  }

  const results = await Promise.allSettled(players.map(p => stripe.paymentIntents.capture(p.payment_intent_id!)))
  const failed = players.filter((_, i) => results[i].status === 'rejected')
  if (failed.length > 0) {
    // Rare: a hold that was live a moment ago failed to capture. Refund the
    // ones that did capture so the group is made whole, then reopen.
    const captured = players.filter((_, i) => results[i].status === 'fulfilled')
    const refunds = await Promise.allSettled(
      captured.map(p => stripe.refunds.create({ payment_intent: p.payment_intent_id! })),
    )
    if (refunds.some(r => r.status === 'rejected')) {
      Sentry.captureException(new Error(`Refund failed after partial capture for game ${game.id}`), {
        tags: { module: 'gameLifecycle', step: 'refund_after_capture_failure' },
      })
    }
    await reopenWithout(svc, game, failed, captured.length)
    return { ok: false, error: 'A payment failed, so everyone was refunded. Please try again.', reopened: failed.length }
  }

  const { data: updated } = await svc
    .from('sessions')
    .update({ status: 'confirmed' })
    .eq('id', game.id)
    .eq('status', 'full')
    .select('id')
  if (!updated || updated.length === 0) {
    Sentry.captureException(new Error(`Captured payments but status update matched nothing for game ${game.id}`), {
      tags: { module: 'gameLifecycle', step: 'confirm_status' },
    })
  }

  await notify(svc, game.id, players.map(p => p.user_id), 'Your game is confirmed! The pitch is booked, see you there.')
  return { ok: true }
}

async function reopenWithout(svc: Svc, game: GameRow, removed: PlayerRow[], remaining: number) {
  const removedIds = removed.map(p => p.id)
  await Promise.all(removed.map(p => releaseHold(p.payment_intent_id)))
  await svc.from('players').delete().in('id', removedIds)
  await svc.from('sessions').update({ status: 'filling', full_at: null }).eq('id', game.id).eq('status', 'full')
  await notify(
    svc,
    game.id,
    removed.map(p => p.user_id),
    'Your card hold expired, so your spot has been freed up. Rejoin to secure your place.',
  )
  await notify(
    svc,
    game.id,
    [game.organiser_id],
    `${removed.length} card hold${removed.length === 1 ? '' : 's'} expired, so nobody was charged and the game needs ${removed.length} more player${removed.length === 1 ? '' : 's'} (${remaining} paid so far).`,
  )
}

// Cheap per-game check used when a game page loads, so a stale game is
// closed even before the daily cron runs.
export async function expireIfNeeded(svc: Svc, game: GameRow): Promise<GameRow['status']> {
  if (game.game_kind !== 'organiser') return game.status

  if (game.status === 'full' && game.full_at) {
    const deadline = new Date(game.full_at).getTime() + CONFIRM_WINDOW_HOURS * 3_600_000
    if (Date.now() > deadline) {
      const ended = await endGame(
        svc,
        game,
        'cancelled',
        "The organiser didn't confirm the booking in time, so the game was cancelled. No charge was made.",
        "You didn't confirm the booking in time, so the game was cancelled and nobody was charged.",
      )
      return ended ? 'cancelled' : game.status
    }
  }

  if ((game.status === 'filling' || game.status === 'full') && game.game_date && game.start_time) {
    if (Date.now() > kickoffMs(game.game_date, game.start_time)) {
      const ended = await endGame(svc, game, 'expired', 'This game has passed. No charge was made.')
      return ended ? 'expired' : game.status
    }
  }
  return game.status
}

// Daily cron: sweep every open organiser game.
export async function expireStaleGames(): Promise<number> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('sessions')
    .select(GAME_COLS)
    .eq('game_kind', 'organiser')
    .in('status', ['filling', 'full'])
    .lte('game_date', londonToday())
    .limit(500)
  const { data: fulls } = await svc
    .from('sessions')
    .select(GAME_COLS)
    .eq('game_kind', 'organiser')
    .eq('status', 'full')
    .limit(500)

  const seen = new Set<string>()
  let ended = 0
  for (const g of [...((data ?? []) as GameRow[]), ...((fulls ?? []) as GameRow[])]) {
    if (seen.has(g.id)) continue
    seen.add(g.id)
    const before = g.status
    const after = await expireIfNeeded(svc, g)
    if (after !== before) ended++
  }
  return ended
}
