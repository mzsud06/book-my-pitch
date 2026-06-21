import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Nav from '@/components/Nav'
import SlotsClient, { SessionData, DbSlot } from './SlotsClient'
import { getSlotsForDay } from '@/lib/slots'

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
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const venueId = venue?.id ?? process.env.GLOBE_VENUE_ID ?? ''

  if (venueId) {
    // Ensure every slot template for the next 14 days exists in the DB.
    // INSERT ... ON CONFLICT DO NOTHING — fast no-ops after first run.
    const slotInserts: {
      venue_id: string
      date: string
      start_time: string
      end_time: string
      type: string
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
          date: dateStr,
          start_time: t.startTime,
          end_time: t.endTime,
          type: t.type,
          price: t.priceGBP,
          max_players: t.maxPlayers,
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
        status,
        organiser_name,
        team_name,
        is_public,
        game_type,
        matched_session_id,
        slots!inner(id, date, start_time, end_time, type, price, max_players, venue_id),
        players(count)
      `)
      .eq('slots.venue_id', venueId)
      .gte('slots.date', todayStr)
      .lte('slots.date', endStr)
      .in('status', ['filling', 'confirmed']),
    supabase
      .from('slots')
      .select('id, date, start_time')
      .eq('venue_id', venueId)
      .gte('date', todayStr)
      .lte('date', endStr),
  ])

  // Build a map of slot_id → session_id for slots where the current user
  // already has an active session (as organiser or as a player).
  let userSlotSessionMap: Record<string, string> = {}
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
    asOrganiser?.forEach(s => { userSlotSessionMap[s.slot_id] = s.id })
    ;(asPlayer as unknown as { id: string; slot_id: string }[] | null)
      ?.forEach(s => { userSlotSessionMap[s.slot_id] = s.id })
  }

  return (
    <>
      <Nav />
      <SlotsClient
        initialSessions={(sessions ?? []) as unknown as SessionData[]}
        dbSlots={(dbSlots ?? []) as DbSlot[]}
        venueId={venueId}
        userSlotSessionMap={userSlotSessionMap}
      />
    </>
  )
}
