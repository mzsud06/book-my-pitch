import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import JoinForm from '@/components/JoinForm'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ organiser?: string }>
}

interface SlotData {
  id: string
  date: string
  start_time: string
  end_time: string
  type: string
  price: number
  max_players: number
}

export default async function JoinSessionPage({ params, searchParams }: Props) {
  const { id } = await params
  const { organiser } = await searchParams
  const isOrganiser = organiser === '1'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, status, organiser_name, organiser_id, game_type,
      slots(id, date, start_time, end_time, type, price, max_players),
      players(id, name, user_id)
    `)
    .eq('id', id)
    .single()

  if (!session) notFound()
  if (session.status === 'confirmed') redirect(`/session/${id}`)

  // If the logged-in user is already a player in this session, send them straight
  // back rather than letting them pay again.
  if (user) {
    const { data: alreadyIn } = await supabase
      .from('players')
      .select('id')
      .eq('session_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (alreadyIn) redirect(`/session/${id}?already=1`)
  }

  // Get the slot ID safely
  const slots = session.slots
  const slot = Array.isArray(slots) ? slots[0] : slots
  const slotId = (slot as SlotData)?.id
  if (!slotId) notFound()

  const maxPlayers = (slot as SlotData)?.max_players ?? 10
  const sessionOrganiserId = (session as unknown as { organiser_id: string | null }).organiser_id
  const sessionPlayers = Array.isArray(session.players)
    ? (session.players as { id: string; name: string; user_id: string | null }[])
    : []
  // If the organiser hasn't completed payment yet (no player row), they hold a reserved
  // slot. Don't count them twice if they already have a player row.
  const organiserHasPlayerRow = sessionOrganiserId
    ? sessionPlayers.some(p => p.user_id === sessionOrganiserId)
    : true
  const organiserReserved = !organiserHasPlayerRow && !!sessionOrganiserId
  if (sessionPlayers.length >= (organiserReserved ? maxPlayers - 1 : maxPlayers)) redirect(`/session/${id}`)
  // Display count for JoinForm fill grid: paid player rows + 1 for any reserved organiser slot
  const playerCount = sessionPlayers.length + (organiserReserved ? 1 : 0)

  // Check for rival sessions
  const { data: rivals } = await supabase
    .from('sessions')
    .select('id')
    .eq('slot_id', slotId)
    .eq('status', 'filling')
    .neq('id', id)

  const hasRival = (rivals?.length ?? 0) > 0

  return (
    <>
      <Nav />
      <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}>
        <JoinForm
          slot={slot as SlotData}
          isOrganiser={isOrganiser}
          sessionId={id}
          existingPlayerCount={playerCount}
          hasRival={hasRival}
          isLoggedIn={!!user}
          gameType={(session as unknown as { game_type: string | null }).game_type ?? undefined}
        />
      </Suspense>
    </>
  )
}
