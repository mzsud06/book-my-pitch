import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

const PHONE_RE = /^\+[0-9]{7,15}$/

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`link-player-account:${getClientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { playerId, userId, phone } = body

    if (!isValidUUID(playerId) || !isValidUUID(userId)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
    }

    const trimmedPhone = typeof phone === 'string' ? phone.trim() : ''
    if (!trimmedPhone || !PHONE_RE.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // Caller must be authenticated, and may only link a player row to their OWN account.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceClient()

    const { data: player } = await svc
      .from('players')
      .select('id, user_id, phone')
      .eq('id', playerId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const p = player as unknown as { id: string; user_id: string | null; phone: string | null }

    // Already claimed by this same user — succeed silently (idempotent).
    if (p.user_id === user.id) {
      return NextResponse.json({ ok: true })
    }
    // Already claimed by a DIFFERENT user — never overwrite an existing link.
    if (p.user_id !== null) {
      return NextResponse.json({ error: 'Player already linked to another account' }, { status: 409 })
    }

    // The phone supplied must match the phone this player row was created with —
    // i.e. the caller must be able to prove they are the person who joined as this
    // guest, not just anyone who knows the player's row ID.
    if (!p.phone || p.phone !== trimmedPhone) {
      return NextResponse.json({ error: 'Phone number does not match this player' }, { status: 403 })
    }

    await svc
      .from('players')
      .update({ user_id: userId })
      .eq('id', playerId)
      .is('user_id', null)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
