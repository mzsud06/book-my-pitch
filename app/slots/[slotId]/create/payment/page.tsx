import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import OrganiserPaymentForm from './OrganiserPaymentForm'
import { combineSlots } from '@/lib/slots'

interface Props {
  params: Promise<{ slotId: string }>
  searchParams: Promise<{ challenge?: string; slotIds?: string }>
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
  const { challenge, slotIds: slotIdsParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/slots/${slotId}/create`)}&message=Please log in to create a game`)
  }

  const idsToFetch = slotIdsParam ? slotIdsParam.split(',').filter(Boolean) : [slotId]

  const { data: rawSlots } = await supabase
    .from('slots')
    .select('id, date, start_time, end_time, type, price, max_players, venues(name, address)')
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
    type: combined.first.type,
    price: combined.price,
    max_players: combined.max_players,
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
        slotIds={combined.ids}
        challengeSessionId={challenge ?? null}
        challengedTeamName={challengedTeamName}
        challengedPlayerCount={challengedPlayerCount}
      />
    </>
  )
}
