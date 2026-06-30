import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import PlayerPaymentForm from './PlayerPaymentForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PlayerPaymentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, status, organiser_id, game_type,
      slots(id, price, max_players),
      players(id, user_id)
    `)
    .eq('id', id)
    .single()

  if (!session) notFound()
  if (session.status === 'confirmed') redirect(`/session/${id}`)

  if (user) {
    const { data: alreadyIn } = await supabase
      .from('players')
      .select('id')
      .eq('session_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (alreadyIn) redirect(`/session/${id}?already=1`)
  }

  const slots = session.slots
  const slot = (Array.isArray(slots) ? slots[0] : slots) as { id: string; price: number; max_players: number } | null
  if (!slot) notFound()

  const maxPlayers = slot.max_players ?? 10
  const sessionOrganiserId = (session as unknown as { organiser_id: string | null }).organiser_id
  const sessionPlayers = Array.isArray(session.players)
    ? (session.players as { id: string; user_id: string | null }[])
    : []

  const organiserHasPlayerRow = sessionOrganiserId
    ? sessionPlayers.some(p => p.user_id === sessionOrganiserId)
    : true
  const organiserReserved = !organiserHasPlayerRow && !!sessionOrganiserId

  if (sessionPlayers.length >= (organiserReserved ? maxPlayers - 1 : maxPlayers)) {
    redirect(`/session/${id}`)
  }

  const playerCount = sessionPlayers.length + (organiserReserved ? 1 : 0)

  const { data: rivals } = await supabase
    .from('sessions')
    .select('id')
    .eq('slot_id', slot.id)
    .eq('status', 'filling')
    .neq('id', id)

  const hasRival = (rivals?.length ?? 0) > 0

  return (
    <>
      <Nav />
      <PlayerPaymentForm
        sessionId={id}
        slot={slot}
        existingPlayerCount={playerCount}
        hasRival={hasRival}
        isLoggedIn={!!user}
      />
    </>
  )
}
