import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLAYER_FEE_PENCE } from '@/lib/stripe'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { GAME_COLS, GameRow, formatGameDate, formatTime, isValidUUID, paidSpots, CONFIRM_WINDOW_HOURS } from '@/lib/games'
import { expireIfNeeded, releaseHold } from '@/lib/gameLifecycle'
import { emailOrganiserGameFull } from '@/lib/gameEmail'

// Step 2 of joining: the card hold succeeded in the browser. Verify it with
// Stripe, add the player, and if that was the last paid spot flip the game to
// 'full' and tell the organiser to book the pitch. Nobody is charged yet.
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`join:${getClientIp(req)}`, 50, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  let paymentIntentId: string | null = null
  try {
    const body = await req.json()
    const { sessionId, name, phone } = body
    paymentIntentId = typeof body.paymentIntentId === 'string' ? body.paymentIntentId : null

    if (!isValidUUID(sessionId) || !paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || trimmedName.length > 100 || !/^[A-Za-z\s'-]+$/.test(trimmedName)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : ''
    if (!/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const svc = createServiceClient()

    const { data: gameData } = await svc.from('sessions').select(GAME_COLS).eq('id', sessionId).maybeSingle()
    const game = gameData as GameRow | null
    if (!game || game.game_kind !== 'organiser') {
      await releaseHold(paymentIntentId)
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Trust Stripe, not the browser: the hold must be live, for this game, at the right price.
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (
      pi.status !== 'requires_capture' ||
      pi.metadata?.session_id !== sessionId ||
      pi.amount !== (game.share_pence ?? 0) + PLAYER_FEE_PENCE
    ) {
      return NextResponse.json({ error: 'Your card hold could not be verified. Please try again.' }, { status: 400 })
    }

    const { data: reused } = await svc.from('players').select('id').eq('payment_intent_id', paymentIntentId).maybeSingle()
    if (reused) return NextResponse.json({ error: 'This payment was already used' }, { status: 409 })

    const status = await expireIfNeeded(svc, game)
    if (status !== 'filling') {
      await releaseHold(paymentIntentId)
      return NextResponse.json({ error: 'This game is no longer taking players. Your card was not charged.' }, { status: 409 })
    }

    // Duplicate-join guard.
    const dupQuery = svc.from('players').select('id').eq('session_id', sessionId)
    const { data: dup } = user?.id
      ? await dupQuery.eq('user_id', user.id).maybeSingle()
      : await dupQuery.eq('phone', trimmedPhone).maybeSingle()
    if (dup) {
      await releaseHold(paymentIntentId)
      return NextResponse.json({ error: "You're already in this game" }, { status: 409 })
    }

    const cap = paidSpots(game)
    const { data: inserted, error: insertError } = await svc
      .from('players')
      .insert({
        session_id: sessionId,
        user_id: user?.id ?? null,
        name: trimmedName,
        phone: trimmedPhone,
        payment_intent_id: paymentIntentId,
      })
      .select('id')
      .single()
    if (insertError || !inserted) {
      Sentry.captureException(new Error(insertError?.message ?? 'Player insert returned nothing'), {
        tags: { route: 'POST /api/join', step: 'player_insert' },
      })
      await releaseHold(paymentIntentId)
      return NextResponse.json({ error: 'Could not add you to the game. Your card was not charged.' }, { status: 500 })
    }

    // Two people can race for the last spot. Rank everyone by join order and
    // drop whoever ended up beyond the cap (deterministic, so exactly the
    // latest joiner loses).
    const { data: all } = await svc
      .from('players')
      .select('id')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true })
      .order('id', { ascending: true })
    const ids = (all ?? []).map(p => p.id as string)
    if (ids.indexOf(inserted.id) >= cap) {
      await svc.from('players').delete().eq('id', inserted.id)
      await releaseHold(paymentIntentId)
      return NextResponse.json({ error: 'Someone just took the last spot. Your card was not charged.' }, { status: 409 })
    }

    const count = ids.length
    if (game.organiser_id && count < cap) {
      await svc.from('notifications').insert({
        user_id: game.organiser_id,
        session_id: sessionId,
        message: `${trimmedName} joined, ${count}/${cap} paid spots filled.`,
      })
    }

    if (count >= cap) {
      const { data: flipped } = await svc
        .from('sessions')
        .update({ status: 'full', full_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('status', 'filling')
        .select('id')
      if (flipped && flipped.length > 0 && game.organiser_id) {
        await svc.from('notifications').insert({
          user_id: game.organiser_id,
          session_id: sessionId,
          message: 'Your game is full. Book the pitch now, then confirm it.',
        })
        await emailOrganiserGameFull({
          organiserId: game.organiser_id,
          gameId: sessionId,
          title: game.title ?? 'Football',
          venueName: game.venue_name ?? '',
          when: `${formatGameDate(game.game_date!)} ${formatTime(game.start_time!)}`,
          hours: CONFIRM_WINDOW_HOURS,
        })
      }
    }

    return NextResponse.json({ sessionId, playerCount: count })
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'POST /api/join' } })
    console.error('join error:', err)
    if (paymentIntentId) await releaseHold(paymentIntentId)
    return NextResponse.json({ error: 'Internal server error. Your card was not charged.' }, { status: 500 })
  }
}
