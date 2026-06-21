import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import OrganiserPaymentForm from './OrganiserPaymentForm'

interface Props {
  params: Promise<{ slotId: string }>
  searchParams: Promise<{ challenge?: string }>
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

export default async function CreatePaymentPage({ params, searchParams }: Props) {
  const { slotId } = await params
  const { challenge } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/slots/${slotId}/create`)}&message=Please log in to create a game`)
  }

  const { data: raw } = await supabase
    .from('slots')
    .select('id, date, start_time, end_time, type, price, max_players, venues(name, address)')
    .eq('id', slotId)
    .single()

  if (!raw) notFound()

  const rawVenue = (raw as unknown as SlotRow).venues
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

  let challengedTeamName: string | null = null
  let challengedPlayerCount: number | null = null
  if (challenge) {
    const { data: challengeSession } = await supabase
      .from('sessions')
      .select('team_name, players(count)')
      .eq('id', challenge)
      .single()
    if (challengeSession) {
      challengedTeamName = (challengeSession as unknown as { team_name: string | null }).team_name
      const players = (challengeSession as unknown as { players: { count: number }[] }).players
      challengedPlayerCount = players?.[0]?.count ?? 0
    }
  }

  return (
    <>
      <Nav />
      <OrganiserPaymentForm
        slot={slot}
        challengeSessionId={challenge ?? null}
        challengedTeamName={challengedTeamName}
        challengedPlayerCount={challengedPlayerCount}
      />
    </>
  )
}
