import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import OrganiserPaymentForm from './OrganiserPaymentForm'
import { combineSlots, getSlotType, Pitch } from '@/lib/slots'

const PITCH_COLS = 'id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price'

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
  venues: { name: string; address: string } | { name: string; address: string }[] | null
}

export default async function CreatePaymentPage({ params, searchParams }: Props) {
  const { slotId } = await params
  const { slotIds: slotIdsParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/slots/create/${slotId}`)}&message=Please log in to create a game`)
  }

  const idsToFetch = slotIdsParam ? slotIdsParam.split(',').filter(Boolean) : [slotId]

  const { data: rawSlots } = await supabase
    .from('slots')
    .select(`id, date, start_time, end_time, price, max_players, pitches(${PITCH_COLS}), venues(name, address)`)
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
    type: getSlotType(combined.date, combined.start_time),
    price: combined.price,
    max_players: combined.pitches.max_players,
    pitches: combined.pitches,
    venue: venue as { name: string; address: string } | null,
  }

  return (
    <>
      <Nav />
      <OrganiserPaymentForm
        slot={slot}
        slotIds={combined.ids}
      />
    </>
  )
}
