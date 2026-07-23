import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Nav from '@/components/Nav'
import SlotsClient, { SessionData, DbSlot } from './SlotsClient'
import { seedSlotsForVenue, cleanupExpiredSessions, ukDateStr, SLOT_SEED_DAYS } from '@/lib/seedSlots'
import { Pitch } from '@/lib/slots'

const PITCH_COLS = 'id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price'

interface Props {
  params: Promise<{ venueId: string }>
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default async function VenueSlotsPage({ params }: Props) {
  const { venueId } = await params
  const supabase = await createClient()
  // Service client used for write operations (upsert slots, delete expired sessions/players)
  // so these work regardless of RLS policies and the calling user's auth state.
  const svc = createServiceClient()

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address')
    .eq('id', venueId)
    .single()

  if (!venue) notFound()

  const { data: pitches } = await supabase
    .from('pitches')
    .select(PITCH_COLS)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: true })

  const venuePitches = (pitches ?? []) as unknown as Pitch[]

  const today = new Date()
  const todayStr = ukDateStr(today)
  const endStr = ukDateStr(addDays(today, SLOT_SEED_DAYS))

  if (venuePitches.length > 0) {
    // Reusable per venue/pitch — ensures every slot template for the next 14
    // days exists in the DB, regardless of how many pitches this venue has.
    await seedSlotsForVenue(svc, venueId, venuePitches)
    await cleanupExpiredSessions(svc, venueId)
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
        venueName={venue.name}
        venueAddress={venue.address}
        pitches={venuePitches}
        userSlotSessionMap={userSlotSessionMap}
        userSessionIds={userSessionIds}
        userId={user?.id ?? null}
      />
    </>
  )
}
