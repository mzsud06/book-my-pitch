import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getOrganiserStatus } from '@/lib/organiser'
import { MAX_DAYS_AHEAD, addDays, kickoffMs, londonToday, sharePence } from '@/lib/games'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`games-post:${getClientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { title, venueName, date, startTime, totalPounds, maxPlayers, organiserName, organiserPlays } = body

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const name = typeof organiserName === 'string' ? organiserName.trim() : ''
    if (!name || name.length > 100 || !/^[A-Za-z\s'-]+$/.test(name)) {
      return NextResponse.json({ error: 'Enter your name' }, { status: 400 })
    }
    const venue = typeof venueName === 'string' ? venueName.trim() : ''
    if (!venue || venue.length > 100) {
      return NextResponse.json({ error: 'Enter the pitch or venue name' }, { status: 400 })
    }
    const gameTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 80) : 'Football'

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Pick a date' }, { status: 400 })
    }
    if (typeof startTime !== 'string' || !/^\d{2}:\d{2}$/.test(startTime)) {
      return NextResponse.json({ error: 'Pick a start time' }, { status: 400 })
    }
    const today = londonToday()
    if (date < today || date > addDays(today, MAX_DAYS_AHEAD)) {
      return NextResponse.json(
        { error: `Games can be set up to ${MAX_DAYS_AHEAD} days ahead, so card holds don't expire before kick-off.` },
        { status: 400 },
      )
    }
    if (kickoffMs(date, startTime) <= Date.now()) {
      return NextResponse.json({ error: 'That start time has already passed' }, { status: 400 })
    }

    const total = Number(totalPounds)
    if (!Number.isFinite(total) || total < 1 || total > 500) {
      return NextResponse.json({ error: 'Enter the total pitch cost in pounds' }, { status: 400 })
    }
    const totalPence = Math.round(total * 100)
    const max = Number(maxPlayers)
    if (!Number.isInteger(max) || max < 2 || max > 22) {
      return NextResponse.json({ error: 'Players must be between 2 and 22' }, { status: 400 })
    }
    const plays = organiserPlays !== false

    // Money has to be able to reach the organiser before anyone pays in.
    const status = await getOrganiserStatus(user.id)
    if (!status.ready) {
      return NextResponse.json({ error: 'Set up payouts first', code: 'payouts_required' }, { status: 403 })
    }

    const svc = createServiceClient()
    const { data: game, error } = await svc
      .from('sessions')
      .insert({
        game_kind: 'organiser',
        game_type: 'private',
        status: 'filling',
        organiser_id: user.id,
        organiser_name: name,
        organiser_plays: plays,
        title: gameTitle,
        venue_name: venue,
        game_date: date,
        start_time: startTime,
        total_cost_pence: totalPence,
        max_players: max,
        share_pence: sharePence(totalPence, max),
      })
      .select('id')
      .single()

    if (error || !game) {
      Sentry.captureException(new Error(error?.message ?? 'Game insert returned nothing'), {
        tags: { route: 'POST /api/games' },
      })
      return NextResponse.json({ error: 'Could not create the game' }, { status: 500 })
    }
    return NextResponse.json({ id: game.id })
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'POST /api/games' } })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
