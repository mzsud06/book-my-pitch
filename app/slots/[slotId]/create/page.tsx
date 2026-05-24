import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import CreateSessionForm from './CreateSessionForm'

interface Props {
  params: Promise<{ slotId: string }>
}

interface SlotRow {
  id: string
  date: string
  start_time: string
  end_time: string
  type: string
  price: number
  max_players: number
  venues: { name: string; address: string } | { name: string; address: string }[] | null
}

export default async function CreateSessionPage({ params }: Props) {
  const { slotId } = await params
  const supabase = await createClient()

  // Auth guard — creating a game requires a logged-in account
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const returnTo = encodeURIComponent(`/slots/${slotId}/create`)
    const msg = encodeURIComponent('You need an account to create a game')
    redirect(`/auth/login?redirect=${returnTo}&message=${msg}`)
  }

  const { data: raw } = await supabase
    .from('slots')
    .select('id, date, start_time, end_time, type, price, max_players, venues(name, address)')
    .eq('id', slotId)
    .single()

  if (!raw) notFound()

  const rawVenue = (raw as SlotRow).venues
  const venue = Array.isArray(rawVenue) ? rawVenue[0] : rawVenue

  const slot = {
    id: raw.id,
    date: raw.date,
    start_time: raw.start_time,
    end_time: raw.end_time,
    type: raw.type,
    price: raw.price,
    max_players: raw.max_players,
    venue: venue as { name: string; address: string } | null,
  }

  return (
    <>
      <Nav />
      <CreateSessionForm slot={slot} />
    </>
  )
}
