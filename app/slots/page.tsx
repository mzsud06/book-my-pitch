import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Nav from '@/components/Nav'
import SlotsClient, { SessionData, DbSlot } from './SlotsClient'
import { getSlotsForDay, priceForSlotType, Pitch } from '@/lib/slots'

const PITCH_COLS = 'id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price'

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Format a date as YYYY-MM-DD in Europe/London timezone so server-side dates
// always match what a UK user's browser considers "today", avoiding off-by-one
// errors during the 23:00–00:00 UTC window (midnight–01:00 BST).
function ukDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(date)
}

export default async function SlotsPage() {
  const supabase = await createClient()
  // Service client used for write operations (upsert slots, delete expired sessions/players)
  // so these work regardless of RLS policies and the calling user's auth state.
  const svc = createServiceClient()

  const today = new Date()
  const todayStr = ukDateStr(today)
  const endStr = ukDateStr(addDays(today, 14))

  // Look up the venue — avoids needing GLOBE_VENUE_ID in env
  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const venueId = venue?.id ?? process.env.GLOBE_VENUE_ID ?? ''
  const venueName = venue?.name ?? 'your local pitch'
  const venueAddress = venue?.address ?? ''

  // Look up the pitch for this venue — slot price/max_players/format are
  // seeded from here, not hardcoded.
  const { data: pitch } = venueId
    ? await supabase
        .from('pitches')
        .select(PITCH_COLS)
        .eq('venue_id', venueId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
    : { data: null as Pitch | null }

  if (venueId && pitch) {
    // Ensure every slot template for the next 14 days exists in the DB.
    // INSERT ... ON CONFLICT DO NOTHING — fast no-ops after first run.
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

    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i)
      const dateStr = ukDateStr(d)
      // Use noon on the UK date so getDay() returns the correct UK weekday
      // even during the 23:00–00:00 UTC hour when UTC day != UK day.
      const ukNoon = new Date(`${dateStr}T12:00:00`)
      getSlotsForDay(ukNoon).forEach(t => {
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

    // Use service client — slot upsert must not depend on RLS INSERT policies
    await svc
      .from('slots')
      .upsert(slotInserts, { onConflict: 'venue_id,date,start_time', ignoreDuplicates: false })

    // Delete filling sessions whose slot date has passed, along with their players.
    // Service client required — no anon DELETE policy exists on sessions/players.
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

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: sessions }, { data: dbSlots }] = await Promise.all([
    supabase
      .from('sessions')
      .select(`
        id,
        slot_id,
        organiser_id,
        status,
        organiser_name,
        is_public,
        game_type,
        slot_ids,
        slots!inner(id, date, start_time, end_time, price, max_players, venue_id, pitches(${PITCH_COLS})),
        players(count)
      `)
      .eq('slots.venue_id', venueId)
      .gte('slots.date', todayStr)
      .lte('slots.date', endStr)
      .in('status', ['filling', 'confirmed']),
    supabase
      .from('slots')
      .select(`id, date, start_time, price, pitches(${PITCH_COLS})`)
      .eq('venue_id', venueId)
      .gte('date', todayStr)
      .lte('date', endStr),
  ])

  // userSlotSessionMap: slot_id → session_id only for sessions the user ORGANISES.
  // Used to show "YOUR GAME" badge and redirect the card click to their own session.
  // userSessionIds: all session ids the user is in (organiser OR player).
  // Used for the "✓ Joined" pill in dropdown rows.
  let userSlotSessionMap: Record<string, string> = {}
  let userSessionIds: string[] = []
  if (user) {
    const [{ data: asOrganiser }, { data: asPlayer }] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, slot_id')
        .eq('organiser_id', user.id)
        .in('status', ['filling', 'confirmed']),
      supabase
        .from('sessions')
        .select('id, slot_id, players!inner(user_id)')
        .eq('players.user_id', user.id)
        .in('status', ['filling', 'confirmed']),
    ])
    asOrganiser?.forEach(s => { userSlotSessionMap[s.slot_id] = s.id; userSessionIds.push(s.id) })
    ;(asPlayer as unknown as { id: string; slot_id: string }[] | null)
      ?.forEach(s => { userSessionIds.push(s.id) })
  }

  return (
    <>
      <Nav />
      <SlotsClient
        initialSessions={(sessions ?? []) as unknown as SessionData[]}
        dbSlots={(dbSlots ?? []) as unknown as DbSlot[]}
        venueId={venueId}
        venueName={venueName}
        venueAddress={venueAddress}
        pitchFormat={pitch?.format ?? '5-a-side'}
        pitchSurface={pitch?.surface ?? '4G'}
        userSlotSessionMap={userSlotSessionMap}
        userSessionIds={userSessionIds}
        userId={user?.id ?? null}
      />
    </>
  )
}
