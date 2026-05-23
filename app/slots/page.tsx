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

  const [{ data: sessions }, { data: dbSlots }] = await Promise.all([
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
  ])

  return (
    <>
      <Nav />
      <SlotsClient
        initialSessions={(sessions ?? []) as unknown as SessionData[]}
        dbSlots={(dbSlots ?? []) as DbSlot[]}
        venueId={venueId}
      />
    </>
  )
}
