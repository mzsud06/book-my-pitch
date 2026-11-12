import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logSecurityEvent } from '@/lib/securityLog'
import { isValidUUID } from '@/lib/games'
import { releaseHold } from '@/lib/gameLifecycle'

// A player drops out: their hold is released (free) and the spot reopens.
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`leave:${getClientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  try {
    const { sessionId, phone } = await req.json()
    if (!isValidUUID(sessionId)) return NextResponse.json({ error: 'Invalid game' }, { status: 400 })
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : null
    if (trimmedPhone && !/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const svc = createServiceClient()

    const { data: game } = await svc
      .from('sessions')
      .select('id, status, organiser_id, title')
      .eq('id', sessionId)
      .maybeSingle()
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    if (game.status !== 'filling' && game.status !== 'full') {
      return NextResponse.json({ error: "You can't leave a game that has already been decided" }, { status: 400 })
    }

    type P = { id: string; name: string; user_id: string | null; phone: string | null; payment_intent_id: string | null }
    let player: P | null = null
    if (user?.id) {
      const { data } = await svc
        .from('players')
        .select('id, name, user_id, phone, payment_intent_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
      player = data as P | null
    }
    if (!player && trimmedPhone) {
      const { data } = await svc
        .from('players')
        .select('id, name, user_id, phone, payment_intent_id')
        .eq('session_id', sessionId)
        .eq('phone', trimmedPhone)
        .maybeSingle()
      player = data as P | null
      if (!player) logSecurityEvent('leave_phone_mismatch', { sessionId, ip: getClientIp(req) })
    }
    if (!player) return NextResponse.json({ error: 'You are not in this game' }, { status: 404 })

    await releaseHold(player.payment_intent_id)
    const { error } = await svc.from('players').delete().eq('id', player.id)
    if (error) return NextResponse.json({ error: 'Failed to leave' }, { status: 500 })

    // A full game with a spot freed goes back to filling.
    if (game.status === 'full') {
      await svc.from('sessions').update({ status: 'filling', full_at: null }).eq('id', sessionId).eq('status', 'full')
    }
    if (game.organiser_id) {
      await svc.from('notifications').insert({
        user_id: game.organiser_id,
        session_id: sessionId,
        message: `${player.name.split(' ')[0]} dropped out, one spot is open again.`,
      })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
