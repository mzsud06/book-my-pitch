import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import SlotsClient, { SessionData, DbSlot } from './SlotsClient'
import { getSlotsForDay } from '@/lib/slots'

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default async function SlotsPage() {
  const supabase = await createClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const endStr = addDays(today, 14).toISOString().split('T')[0]

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
      getSlotsForDay(d).forEach(t => {
        slotInserts.push({
          venue_id: venueId,
          date: d.toISOString().split('T')[0],
          start_time: t.startTime,
          end_time: t.endTime,
          type: t.type,
          price: t.priceGBP,
          max_players: t.maxPlayers,
        })
      })
    }

    await supabase
      .from('slots')
      .upsert(slotInserts, { onConflict: 'venue_id,date,start_time', ignoreDuplicates: true })
  }

  // Identify the logged-in user so we can highlight slots they've already joined.
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: sessions }, { data: dbSlots }, myPlayersResult] = await Promise.all([
    supabase
      .from('sessions')
      .select(`
        id,
        slot_id,
        status,
        organiser_name,
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
    // For logged-in users: find which sessions they've already joined so the
    // slots page can show "You're in this game" on the relevant slot cards.
    user
      ? supabase
          .from('players')
          .select('session_id, sessions(slot_id, status)')
          .eq('user_id', user.id)
      : Promise.resolve({ data: null }),
  ])

  // Build slot_id → session_id for the current user's active sessions.
  const mySlotToSession: Record<string, string> = {}
  type PlayerRow = { session_id: string; sessions: { slot_id: string; status: string } | { slot_id: string; status: string }[] | null }
  ;(myPlayersResult.data as PlayerRow[] | null ?? []).forEach(p => {
    const sess = Array.isArray(p.sessions) ? p.sessions[0] : p.sessions
    if (sess && ['filling', 'confirmed'].includes(sess.status)) {
      mySlotToSession[sess.slot_id] = p.session_id
    }
  })

  return (
    <>
      <Nav />
      <SlotsClient
        initialSessions={(sessions ?? []) as unknown as SessionData[]}
        dbSlots={(dbSlots ?? []) as DbSlot[]}
        venueId={venueId}
        mySlotToSession={mySlotToSession}
      />
    </>
  )
}
