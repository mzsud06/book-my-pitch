import type { SupabaseClient } from '@supabase/supabase-js'
import { getSlotsForDay, priceForSlotType, scheduleFromVenue, DEFAULT_SCHEDULE, Pitch, VenueSchedule } from './slots'

export const SLOT_SEED_DAYS = 14

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Format a date as YYYY-MM-DD in Europe/London timezone so server-side dates
// always match what a UK user's browser considers "today", avoiding off-by-one
// errors during the 23:00–00:00 UTC window (midnight–01:00 BST).
export function ukDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(date)
}

// Ensures every hourly slot template for the next SLOT_SEED_DAYS days exists in
// the DB for one pitch. INSERT ... ON CONFLICT DO UPDATE — fast no-ops after
// the first run, keyed on (venue_id, pitch_id, date, start_time) so multiple
// pitches at the same venue can each have their own slot at the same time.
async function seedSlotsForPitch(svc: SupabaseClient, venueId: string, pitch: Pitch, schedule: VenueSchedule) {
  const today = new Date()
  const slotInserts: {
    venue_id: string
    pitch_id: string
    date: string
    start_time: string
    end_time: string
    format: string
    price: number
    max_players: number
  }[] = []

  for (let i = 0; i < SLOT_SEED_DAYS; i++) {
    const d = addDays(today, i)
    const dateStr = ukDateStr(d)
    // Use noon on the UK date so getDay() returns the correct UK weekday
    // even during the 23:00–00:00 UTC hour when UTC day != UK day.
    const ukNoon = new Date(`${dateStr}T12:00:00`)
    getSlotsForDay(ukNoon, schedule).forEach(t => {
      slotInserts.push({
        venue_id: venueId,
        pitch_id: pitch.id,
        date: dateStr,
        start_time: t.startTime,
        end_time: t.endTime,
        format: pitch.format,
        price: priceForSlotType(pitch, t.type),
        max_players: pitch.max_players,
      })
    })
  }

  await svc
    .from('slots')
    .upsert(slotInserts, { onConflict: 'venue_id,pitch_id,date,start_time', ignoreDuplicates: false })
}

// Reusable per venue/pitch — call with any venue id and its pitches, no
// per-venue code required. Adding a new venue is a database insert away from
// having its slots seeded. `schedule` defaults to the old global hardcoded
// hours for any caller that hasn't been updated to pass the venue's own yet.
export async function seedSlotsForVenue(svc: SupabaseClient, venueId: string, pitches: Pitch[], schedule: VenueSchedule = DEFAULT_SCHEDULE) {
  await Promise.all(pitches.map(pitch => seedSlotsForPitch(svc, venueId, pitch, schedule)))
}

// Seeds every venue/pitch in the database. Used by the venue picker page so
// slots exist for all venues before a user picks one.
export async function seedSlotsForAllVenues(svc: SupabaseClient) {
  const [{ data: pitches }, { data: venues }] = await Promise.all([
    svc.from('pitches').select('id, venue_id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price'),
    svc.from('venues').select('id, opening_time, closing_time, weekend_opening_time, weekend_closing_time, peak_start_time, daily_hours'),
  ])

  if (!pitches || pitches.length === 0) return

  const schedules = new Map<string, VenueSchedule>(
    ((venues ?? []) as (VenueSchedule & { id: string })[]).map(v => [v.id, scheduleFromVenue(v)])
  )

  const byVenue = new Map<string, Pitch[]>()
  ;(pitches as (Pitch & { venue_id: string })[]).forEach(p => {
    if (!byVenue.has(p.venue_id)) byVenue.set(p.venue_id, [])
    byVenue.get(p.venue_id)!.push(p)
  })

  await Promise.all(
    Array.from(byVenue.entries()).map(([venueId, venuePitches]) =>
      seedSlotsForVenue(svc, venueId, venuePitches, schedules.get(venueId) ?? DEFAULT_SCHEDULE)
    )
  )
}

// Deletes filling sessions whose slot date has passed for a venue, along with
// their players. Service client required — no anon DELETE policy exists on
// sessions/players.
export async function cleanupExpiredSessions(svc: SupabaseClient, venueId: string) {
  const todayStr = ukDateStr(new Date())
  const { data: expiredSessions } = await svc
    .from('sessions')
    .select('id, slots!inner(date)')
    .eq('status', 'filling')
    .eq('slots.venue_id', venueId)
    .lt('slots.date', todayStr)

  if (expiredSessions && expiredSessions.length > 0) {
    const expiredIds = (expiredSessions as unknown as { id: string }[]).map(s => s.id)
    await svc.from('players').delete().in('session_id', expiredIds)
    await svc.from('sessions').delete().in('id', expiredIds)
  }
}
