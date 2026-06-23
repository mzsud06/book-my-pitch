import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { playerId, userId } = body

    if (!isValidUUID(playerId) || !isValidUUID(userId)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { data: player } = await svc
      .from('players')
      .select('id, user_id')
      .eq('id', playerId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const p = player as unknown as { id: string; user_id: string | null }

    // Already claimed — succeed silently (idempotent)
    if (p.user_id !== null) {
      return NextResponse.json({ ok: true })
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
