import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId } = body

    if (!isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: session } = await svc
      .from('sessions')
      .select('id, status, organiser_id, game_type, matched_session_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const s = session as unknown as { id: string; status: string; organiser_id: string | null; game_type: string | null; matched_session_id: string | null }

    if (!s.organiser_id || s.organiser_id !== user.id) {
      return NextResponse.json({ error: 'Only the organiser can cancel this session' }, { status: 403 })
    }

    if (s.status === 'confirmed') {
      return NextResponse.json({ error: 'Confirmed sessions cannot be cancelled' }, { status: 400 })
    }

    if (s.status !== 'filling') {
      return NextResponse.json({ error: 'Session is not in a cancellable state' }, { status: 400 })
    }

    // Challenger sessions (matched_session_id set) may be any game_type.
    // Non-challenger sessions must be private or open to cancel here.
    if (!s.matched_session_id && s.game_type !== 'private' && s.game_type !== 'open') {
      return NextResponse.json({ error: 'This session type cannot be cancelled here' }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = { status: 'cancelled' }
    if (s.game_type === 'open') {
      updatePayload.is_public = false
    }

    const { error: updateError } = await svc
      .from('sessions')
      .update(updatePayload)
      .eq('id', sessionId)

    if (updateError) {
      console.error('Cancel session error:', updateError.message)
      return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 })
    }

    // Notify every player with an account that their game was cancelled.
    const { data: sessionPlayers } = await svc
      .from('players')
      .select('user_id')
      .eq('session_id', sessionId)
      .not('user_id', 'is', null)

    if (sessionPlayers && sessionPlayers.length > 0) {
      await svc.from('notifications').insert(
        (sessionPlayers as unknown as { user_id: string }[]).map(p => ({
          user_id: p.user_id,
          session_id: sessionId,
          message: 'A game you joined was cancelled. No charge was made.',
        }))
      )
    }

    // If this was a challenger, free the LFO session's back-reference so new
    // challengers can claim it. Only clear it if it still points at this session
    // (another challenger may have already won the race and set it to their id).
    if (s.matched_session_id) {
      await svc
        .from('sessions')
        .update({ matched_session_id: null })
        .eq('id', s.matched_session_id)
        .eq('matched_session_id', sessionId)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
