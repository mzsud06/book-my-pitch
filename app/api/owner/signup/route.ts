import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { seedSlotsForVenue } from '@/lib/seedSlots'
import type { Pitch } from '@/lib/slots'

// Lower than the standard 10/hour used elsewhere — this creates an auth
// user, a venue, a pitch, and ~14 days of slot rows in one call, so it's a
// much heavier action than e.g. a Stripe SetupIntent.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Client-supplied "format" only selects a value from this fixed set — the
// resulting max_players always comes from the server, never trusted from
// the request body.
const FORMAT_MAX_PLAYERS: Record<string, number> = {
  '5-a-side': 10,
  '7-a-side': 14,
  '11-a-side': 22,
}
const VALID_SURFACES = new Set(['4G', '3G', 'Grass'])

function isValidPrice(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 500
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`owner-signup:${getClientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { email, password, venueName, address, format, surface, peakPrice, offpeakPrice, weekendPrice } = body

    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const trimmedVenueName = typeof venueName === 'string' ? venueName.trim() : ''
    if (!trimmedVenueName || trimmedVenueName.length > 120) {
      return NextResponse.json({ error: 'Please enter your venue name' }, { status: 400 })
    }
    const trimmedAddress = typeof address === 'string' ? address.trim() : ''
    if (!trimmedAddress || trimmedAddress.length > 300) {
      return NextResponse.json({ error: 'Please enter your venue address' }, { status: 400 })
    }
    const maxPlayers = FORMAT_MAX_PLAYERS[format as string]
    if (!maxPlayers) {
      return NextResponse.json({ error: 'Please choose a valid pitch format' }, { status: 400 })
    }
    if (typeof surface !== 'string' || !VALID_SURFACES.has(surface)) {
      return NextResponse.json({ error: 'Please choose a valid surface' }, { status: 400 })
    }
    if (!isValidPrice(peakPrice) || !isValidPrice(offpeakPrice) || !isValidPrice(weekendPrice)) {
      return NextResponse.json({ error: 'Prices must be whole pounds between £1 and £500' }, { status: 400 })
    }

    // SSR/cookie-bound client — signUp() here both creates the auth user AND
    // (if email confirmation is disabled on this project) sets a session
    // cookie on the response, matching the exact pattern used for player
    // signup at app/auth/signup/page.tsx. We don't special-case the
    // project's email-confirmation setting — same behavior either way.
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
    const newUserId = authData.user?.id
    if (!newUserId) {
      return NextResponse.json({ error: 'Could not create account' }, { status: 500 })
    }

    const svc = createServiceClient()

    // Best-effort cleanup if a later step fails — an owner shouldn't be left
    // with an auth account that has no venue behind it with no way to retry
    // signup (email already registered).
    async function rollbackUser() {
      try {
        await svc.auth.admin.deleteUser(newUserId!)
      } catch (err) {
        console.error('owner-signup: failed to roll back auth user after partial failure:', err)
      }
    }

    const { data: venue, error: venueError } = await svc
      .from('venues')
      .insert({ name: trimmedVenueName, address: trimmedAddress, owner_id: newUserId })
      .select('id')
      .single()

    if (venueError || !venue) {
      console.error('owner-signup: venue insert failed:', venueError?.message)
      await rollbackUser()
      return NextResponse.json({ error: 'Failed to create venue. Please try again.' }, { status: 500 })
    }

    const pitchInsert = {
      venue_id: venue.id,
      name: 'Main Pitch',
      format,
      surface,
      max_players: maxPlayers,
      peak_price: peakPrice,
      offpeak_price: offpeakPrice,
      weekend_price: weekendPrice,
    }
    const { data: pitch, error: pitchError } = await svc
      .from('pitches')
      .insert(pitchInsert)
      .select('*')
      .single()

    if (pitchError || !pitch) {
      console.error('owner-signup: pitch insert failed:', pitchError?.message)
      await svc.from('venues').delete().eq('id', venue.id)
      await rollbackUser()
      return NextResponse.json({ error: 'Failed to create pitch. Please try again.' }, { status: 500 })
    }

    await seedSlotsForVenue(svc, venue.id, [pitch as unknown as Pitch])

    return NextResponse.json({ ok: true, venueId: venue.id, sessionCreated: !!authData.session })
  } catch (err) {
    console.error('owner-signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
