import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import CreateSessionForm from './CreateSessionForm'
import { combineSlots, getSlotType, scheduleFromVenue, Pitch, VenueSchedule } from '@/lib/slots'

const PITCH_COLS = 'id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price'
const VENUE_COLS = 'name, address, opening_time, closing_time, weekend_opening_time, weekend_closing_time, peak_start_time, daily_hours'

interface Props {
  params: Promise<{ slotId: string }>
  searchParams: Promise<{ slotIds?: string }>
}

interface SlotRow {
  id: string
  date: string
  start_time: string
  end_time: string
  price: number
  max_players: number
  pitches: Pitch
  venues: (Partial<VenueSchedule> & { name: string; address: string }) | (Partial<VenueSchedule> & { name: string; address: string })[] | null
}

export default async function CreateSessionPage({ params, searchParams }: Props) {
  const { slotId } = await params
  const { slotIds: slotIdsParam } = await searchParams
  const supabase = await createClient()

  // Auth guard — creating a game requires a logged-in account
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const returnTo = encodeURIComponent(`/slots/create/${slotId}`)
    const msg = encodeURIComponent('You need an account to create a game')
    redirect(`/auth/login?redirect=${returnTo}&message=${msg}`)
  }

  // A multi-hour (60/120/180 min) booking spans several consecutive slot rows —
  // slotIds carries the full list. Falls back to the single route param slot
  // for a normal 60-minute booking.
  const idsToFetch = slotIdsParam ? slotIdsParam.split(',').filter(Boolean) : [slotId]

  const { data: rawSlots } = await supabase
    .from('slots')
    .select(`id, date, start_time, end_time, price, max_players, pitches(${PITCH_COLS}), venues(${VENUE_COLS})`)
    .in('id', idsToFetch)

  if (!rawSlots || rawSlots.length !== idsToFetch.length) notFound()

  const combined = combineSlots(rawSlots as unknown as SlotRow[])
  const rawVenue = combined.first.venues
  const venue = Array.isArray(rawVenue) ? rawVenue[0] : rawVenue

  const slot = {
    id: combined.first.id,
    date: combined.date,
    start_time: combined.start_time,
    end_time: combined.end_time,
    type: getSlotType(combined.date, combined.start_time, scheduleFromVenue(venue)),
    price: combined.price,
    max_players: combined.pitches.max_players,
    pitches: combined.pitches,
    venue: venue as { name: string; address: string } | null,
  }

  return (
    <>
      <Nav />
      <CreateSessionForm slot={slot} slotIds={combined.ids} />
    </>
  )
}
