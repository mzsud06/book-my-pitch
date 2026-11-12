import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { GAME_COLS, GameRow, isValidUUID } from '@/lib/games'
import { confirmGame, expireIfNeeded } from '@/lib/gameLifecycle'

// "I've booked it": captures every player's hold and pays the organiser.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!checkRateLimit(`confirm:${getClientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  try {
    const { id } = await ctx.params
    if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid game' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const svc = createServiceClient()
    const { data } = await svc.from('sessions').select(GAME_COLS).eq('id', id).maybeSingle()
    const game = data as GameRow | null
    if (!game || game.game_kind !== 'organiser') return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    if (game.organiser_id !== user.id) return NextResponse.json({ error: 'Only the organiser can do this' }, { status: 403 })

    const status = await expireIfNeeded(svc, game)
    if (status !== 'full') {
      return NextResponse.json({ error: 'This game is not waiting for confirmation' }, { status: 409 })
    }

    const result = await confirmGame(svc, game)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
