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

    // One session per slot per user: check as organiser
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

    // One session per slot per user: check as player in any active session for this slot
    const { data: activeForSlot } = await supabase
      .from('sessions')
      .select('id')
      .eq('slot_id', slotId)
      .in('status', ['filling', 'confirmed'])

    if (activeForSlot && activeForSlot.length > 0) {
      const { data: asPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .in('session_id', activeForSlot.map(s => s.id))
        .maybeSingle()

      if (asPlayer) {
        return NextResponse.json({ error: 'You already have a session for this slot.' }, { status: 400 })
      }
    }

    // Guard against races: if a filling session already exists, return it
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('slot_id', slotId)
      .eq('status', 'filling')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ sessionId: existing.id, existed: true })
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
      console.error('create session error:', error?.message)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    if (matchedSessionId) {
      const svc = createServiceClient()
      await Promise.all([
        svc.from('sessions').update({ matched_session_id: matchedSessionId }).eq('id', session.id),
        svc.from('sessions').update({ matched_session_id: session.id }).eq('id', matchedSessionId),
      ])
    }

    return NextResponse.json({ sessionId: session.id })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
