import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { seedSlotsForVenue } from '@/lib/seedSlots'
import { notifyAdminNewVenueSignup } from '@/lib/notifyAdmin'
import type { Pitch } from '@/lib/slots'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isValidTime(v: unknown): v is string {
  return typeof v === 'string' && TIME_RE.test(v)
}

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

const MAX_PITCHES_PER_SIGNUP = 12

interface PitchInput {
  format: string
  surface: string
  peakPrice: number
  offpeakPrice: number
  weekendPrice: number
}

function validatePitch(p: unknown, index: number): { pitch: PitchInput } | { error: string } {
  const label = `Pitch ${index + 1}`
  if (typeof p !== 'object' || p === null) return { error: `${label}: invalid pitch data` }
  const { format, surface, peakPrice, offpeakPrice, weekendPrice } = p as Record<string, unknown>
  if (!FORMAT_MAX_PLAYERS[format as string]) return { error: `${label}: please choose a valid pitch format` }
  if (typeof surface !== 'string' || !VALID_SURFACES.has(surface)) return { error: `${label}: please choose a valid surface` }
  if (!isValidPrice(peakPrice) || !isValidPrice(offpeakPrice) || !isValidPrice(weekendPrice)) {
    return { error: `${label}: prices must be whole pounds between £1 and £500` }
  }
  return { pitch: { format: format as string, surface, peakPrice, offpeakPrice, weekendPrice } }
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`owner-signup:${getClientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const {
      email, password, venueName, address, pitches,
      openingTime, closingTime, weekendOpeningTime, weekendClosingTime, peakStartTime,
    } = body

    // SSR/cookie-bound client — also lets us detect a visitor who's already
    // logged in (as a player or a previous owner signup) before touching
    // auth.signUp at all, so a returning user never collides with themselves.
    const supabase = await createClient()
    const { data: { user: existingUser } } = await supabase.auth.getUser()

    if (!existingUser) {
      if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
      }
      if (typeof password !== 'string' || password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }
    }
    const trimmedVenueName = typeof venueName === 'string' ? venueName.trim() : ''
    if (!trimmedVenueName || trimmedVenueName.length > 120) {
      return NextResponse.json({ error: 'Please enter your venue name' }, { status: 400 })
    }
    const trimmedAddress = typeof address === 'string' ? address.trim() : ''
    if (!trimmedAddress || trimmedAddress.length > 300) {
      return NextResponse.json({ error: 'Please enter your venue address' }, { status: 400 })
    }
    // Slots are generated within a single calendar day (see
    // lib/slots.ts:getSlotsForDay) and can't currently wrap past midnight —
    // closing time must be later in the clock than opening time. A venue
    // open e.g. 18:00–01:00 isn't supported yet; the error says so plainly
    // rather than silently accepting it and seeding zero bookable slots.
    if (!isValidTime(openingTime) || !isValidTime(closingTime) || closingTime <= openingTime) {
      return NextResponse.json({ error: 'Weekday closing time must be later than opening time (hours past midnight aren\'t supported yet — contact us if you need this)' }, { status: 400 })
    }
    if (!isValidTime(weekendOpeningTime) || !isValidTime(weekendClosingTime) || weekendClosingTime <= weekendOpeningTime) {
      return NextResponse.json({ error: 'Weekend closing time must be later than opening time (hours past midnight aren\'t supported yet — contact us if you need this)' }, { status: 400 })
    }
    if (!isValidTime(peakStartTime)) {
      return NextResponse.json({ error: 'Please enter a valid peak start time' }, { status: 400 })
    }
    if (!Array.isArray(pitches) || pitches.length === 0 || pitches.length > MAX_PITCHES_PER_SIGNUP) {
      return NextResponse.json({ error: 'Please add at least one pitch' }, { status: 400 })
    }
    const validatedPitches: PitchInput[] = []
    for (let i = 0; i < pitches.length; i++) {
      const result = validatePitch(pitches[i], i)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
      validatedPitches.push(result.pitch)
    }

    let newUserId: string
    let ownerEmail: string
    let sessionCreated: boolean

    if (existingUser) {
      // Already logged in (player or a previous owner signup) — attach the
      // new venue straight to this account instead of trying (and failing)
      // to create a second one with the same email.
      newUserId = existingUser.id
      ownerEmail = existingUser.email ?? ''
      sessionCreated = true
    } else {
      // signUp() here both creates the auth user AND (if email confirmation
      // is disabled on this project) sets a session cookie on the response,
      // matching the exact pattern used for player signup at
      // app/auth/signup/page.tsx. We don't special-case the project's
      // email-confirmation setting — same behavior either way.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
      // Supabase's anti-enumeration protection returns a success response
      // (no authError) for an email that already has an account, rather than
      // revealing it exists — the documented way to detect that case is an
      // empty `identities` array. Without this check we'd silently attach
      // the new venue to a stranger's existing (player) account.
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        return NextResponse.json({
          error: 'An account with this email already exists. Log in, then list your venue from your dashboard.',
        }, { status: 409 })
      }
      if (!authData.user?.id) {
        return NextResponse.json({ error: 'Could not create account' }, { status: 500 })
      }
      newUserId = authData.user.id
      ownerEmail = email.trim()
      sessionCreated = !!authData.session
    }

    const svc = createServiceClient()

    // Best-effort cleanup if a later step fails — an owner shouldn't be left
    // with a brand-new auth account that has no venue behind it with no way
    // to retry signup (email already registered). Never deletes an existing
    // user's account (the existingUser branch above) — only one we just
    // created in this request.
    async function rollbackUser() {
      if (existingUser) return
      try {
        await svc.auth.admin.deleteUser(newUserId)
      } catch (err) {
        console.error('owner-signup: failed to roll back auth user after partial failure:', err)
      }
    }

    const { data: venue, error: venueError } = await svc
      .from('venues')
      .insert({
        name: trimmedVenueName,
        address: trimmedAddress,
        owner_id: newUserId,
        opening_time: openingTime,
        closing_time: closingTime,
        weekend_opening_time: weekendOpeningTime,
        weekend_closing_time: weekendClosingTime,
        peak_start_time: peakStartTime,
      })
      .select('id')
      .single()

    if (venueError || !venue) {
      console.error('owner-signup: venue insert failed:', venueError?.message)
      await rollbackUser()
      return NextResponse.json({ error: 'Failed to create venue. Please try again.' }, { status: 500 })
    }

    const pitchInserts = validatedPitches.map((p, i) => ({
      venue_id: venue.id,
      name: validatedPitches.length > 1 ? `Pitch ${i + 1}` : 'Main Pitch',
      format: p.format,
      surface: p.surface,
      max_players: FORMAT_MAX_PLAYERS[p.format],
      peak_price: p.peakPrice,
      offpeak_price: p.offpeakPrice,
      weekend_price: p.weekendPrice,
    }))
    const { data: insertedPitches, error: pitchError } = await svc
      .from('pitches')
      .insert(pitchInserts)
      .select('*')

    if (pitchError || !insertedPitches || insertedPitches.length === 0) {
      console.error('owner-signup: pitch insert failed:', pitchError?.message)
      await svc.from('venues').delete().eq('id', venue.id)
      await rollbackUser()
      return NextResponse.json({ error: 'Failed to create pitches. Please try again.' }, { status: 500 })
    }

    await seedSlotsForVenue(svc, venue.id, insertedPitches as unknown as Pitch[], {
      opening_time: openingTime,
      closing_time: closingTime,
      weekend_opening_time: weekendOpeningTime,
      weekend_closing_time: weekendClosingTime,
      peak_start_time: peakStartTime,
    })

    // Fire-and-forget — a notification failure must never fail the signup itself.
    void notifyAdminNewVenueSignup({
      name: trimmedVenueName,
      address: trimmedAddress,
      ownerEmail,
    })

    return NextResponse.json({ ok: true, venueId: venue.id, sessionCreated })
  } catch (err) {
    console.error('owner-signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
