import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId } = body

    if (!isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Verify the requesting user is the organiser
    const { data: session } = await svc
      .from('sessions')
      .select('id, organiser_id, status, matched_session_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if ((session as unknown as { organiser_id: string }).organiser_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if ((session as unknown as { status: string }).status !== 'filling') {
      return NextResponse.json({ error: 'Can only delete a filling session' }, { status: 400 })
    }

    // Only delete if no players have joined yet — prevents removing a live game
    const { count: playerCount } = await svc
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    if ((playerCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Session already has players' }, { status: 409 })
    }

    await svc.from('sessions').delete().eq('id', sessionId)

    // In the multi-challenger race model the LFO's matched_session_id is only set when a
    // challenger wins the race at 5 players — never at session creation. A freshly-deleted
    // (0-player) challenger therefore never touched the LFO's matched_session_id, so
    // there is no back-link to clear.

    return NextResponse.json({ ok: true })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'DELETE /api/sessions' },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`sessions-post:${getClientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { slotId, name, phone, teamName, gameType, matchedSessionId } = body

    if (!isValidUUID(slotId)) {
      return NextResponse.json({ error: 'Invalid slot ID' }, { status: 400 })
    }

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: 'Name is too long' }, { status: 400 })
    }
    if (!/^[A-Za-z\s'-]+$/.test(trimmedName)) {
      return NextResponse.json({ error: 'Name contains invalid characters' }, { status: 400 })
    }

    const trimmedPhone = typeof phone === 'string' ? phone.trim() : null
    if (trimmedPhone && !/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    const trimmedTeamName = typeof teamName === 'string' ? teamName.trim() : null
    if (trimmedTeamName && (trimmedTeamName.length > 30 || !/^[a-zA-Z0-9\s]+$/.test(trimmedTeamName))) {
      return NextResponse.json({ error: 'Invalid team name' }, { status: 400 })
    }

    const validGameTypes = ['private', 'looking_for_opposition', 'open']
    if (!validGameTypes.includes(gameType as string)) {
      return NextResponse.json({ error: 'Invalid game type' }, { status: 400 })
    }
    const sessionIsPublic = gameType === 'looking_for_opposition' || gameType === 'open'

    if (matchedSessionId !== undefined && !isValidUUID(matchedSessionId)) {
      return NextResponse.json({ error: 'Invalid matched session ID' }, { status: 400 })
    }

    const supabase = await createClient()

    // Only authenticated users may create sessions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: slot } = await supabase
      .from('slots')
      .select('id')
      .eq('id', slotId)
      .single()

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    // A challenger may only link to a real, still-open, unclaimed LFO session —
    // otherwise a client could point matched_session_id at an arbitrary session
    // (wrong game_type, already confirmed/cancelled, or already claimed by another
    // challenger) and corrupt that session's matching state or payment flow.
    if (matchedSessionId) {
      const svcCheck = createServiceClient()
      const { data: targetSession } = await svcCheck
        .from('sessions')
        .select('id, game_type, status, matched_session_id')
        .eq('id', matchedSessionId)
        .maybeSingle()

      const t = targetSession as unknown as { id: string; game_type: string | null; status: string; matched_session_id: string | null } | null

      if (
        !t ||
        t.game_type !== 'looking_for_opposition' ||
        t.status !== 'filling' ||
        t.matched_session_id !== null
      ) {
        return NextResponse.json({ error: 'That opposition session is no longer available to challenge' }, { status: 400 })
      }
    }

    // Challenge flows (matchedSessionId provided) are exempt from both guards below:
    // the challenger is intentionally creating a new session on a slot where they
    // may already be organising or playing in another session.
    if (!matchedSessionId) {
      // One session per slot per user: block if already organising an active session.
      const { data: asOrganiser } = await supabase
        .from('sessions')
        .select('id')
        .eq('slot_id', slotId)
        .eq('organiser_id', user.id)
        .in('status', ['filling', 'confirmed'])
        .maybeSingle()

      if (asOrganiser) {
        return NextResponse.json({ error: 'You already have a session for this slot.' }, { status: 400 })
      }

      // Double-submit guard: return the existing filling session idempotently so the
      // organiser's join step targets the right session rather than creating a duplicate.
      // Must filter by organiser_id — returning another user's session would let the
      // caller insert themselves as a player in someone else's session.
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('slot_id', slotId)
        .eq('organiser_id', user.id)
        .eq('status', 'filling')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ sessionId: existing.id, existed: true })
      }
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        slot_id: slotId,
        status: 'filling',
        organiser_name: trimmedName,
        organiser_phone: trimmedPhone ?? null,
        organiser_id: user.id,
        team_name: trimmedTeamName || null,
        is_public: sessionIsPublic,
        game_type: gameType as string,
      })
      .select('id')
      .single()

    if (error || !session) {
      Sentry.captureException(new Error(error?.message ?? 'Session insert returned no data'), {
        tags: { route: 'POST /api/sessions', step: 'session_insert' },
        extra: { slot_id: slotId, game_type: gameType },
      })
      console.error('create session error:', error?.message)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    if (matchedSessionId) {
      const svc = createServiceClient()
      // Only set the challenger's own matched_session_id pointing at the LFO session.
      // The LFO session's matched_session_id stays null until a challenger wins the race
      // (fills to 5 players), so multiple challengers can compete simultaneously.
      await svc.from('sessions').update({ matched_session_id: matchedSessionId }).eq('id', session.id)
    }

    return NextResponse.json({ sessionId: session.id })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'POST /api/sessions' },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
