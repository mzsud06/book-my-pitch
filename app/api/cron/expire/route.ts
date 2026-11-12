import { NextRequest, NextResponse } from 'next/server'
import { expireStaleGames } from '@/lib/gameLifecycle'

// Daily sweep (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
// Games are also expired lazily whenever they're loaded, so this is a backstop.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const ended = await expireStaleGames()
  return NextResponse.json({ ended })
}
