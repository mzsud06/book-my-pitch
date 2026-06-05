import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import SessionClient from './SessionClient'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ joined?: string; created?: string; already?: string }>
}

interface SessionData {
  id: string
  status: string
  created_at: string
  organiser_name: string | null
  organiser_phone: string | null
  organiser_id: string | null
  slots: {
    id: string
    date: string
    start_time: string
    end_time: string
    type: string
    price: number
    max_players: number
    venues: { id: string; name: string; address: string }
  }
  players: { id: string; name: string; joined_at: string; session_id: string; user_id: string | null }[]
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { id } = await params
  const { joined, created, already } = await searchParams
  const supabase = await createClient()

  // Session links are the access token — anyone with the link can view and join.
  // No auth gate here; the link itself is what's shared with teammates.

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch session, players, and membership check in parallel.
  // Players are queried separately with an explicit session_id filter rather
  // than as an embedded relation, because PostgREST may pick the wrong foreign
  // key when players has relations to both sessions and slots — causing players
  // from other sessions filling the same slot to bleed in.
  const [{ data: rawSession }, { data: rawPlayers }, { data: memberRow }] = await Promise.all([
    supabase
      .from('sessions')
      .select(`
        id, status, created_at, organiser_name, organiser_phone, organiser_id,
        slots(id, date, start_time, end_time, type, price, max_players,
          venues(id, name, address, stripe_account_id)
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('players')
      .select('id, name, joined_at, session_id, user_id')
      .eq('session_id', id)
      .order('joined_at', { ascending: true }),
    user
      ? supabase.from('players').select('id').eq('session_id', id).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (!rawSession) notFound()

  // Normalize nested arrays from Supabase
  const rawSlots = rawSession.slots as unknown
  const slot = Array.isArray(rawSlots) ? rawSlots[0] : rawSlots
  if (!slot) notFound()

  const rawVenues = (slot as { venues: unknown }).venues
  const venue = Array.isArray(rawVenues) ? rawVenues[0] : rawVenues

  const normalizedSession: SessionData = {
    id: rawSession.id,
    status: rawSession.status,
    created_at: rawSession.created_at,
    organiser_name: (rawSession as unknown as { organiser_name: string | null }).organiser_name ?? null,
    organiser_phone: (rawSession as unknown as { organiser_phone: string | null }).organiser_phone ?? null,
    organiser_id: (rawSession as unknown as { organiser_id: string | null }).organiser_id ?? null,
    slots: {
      ...(slot as SessionData['slots']),
      venues: venue as SessionData['slots']['venues'],
    },
    players: (rawPlayers ?? []) as SessionData['players'],
  }

  // Get slot ID for competing sessions query
  const slotId = (slot as { id: string }).id

  // Get competing sessions for this slot
  const { data: competingSessions } = await supabase
    .from('sessions')
    .select('id, players(count)')
    .eq('slot_id', slotId)
    .eq('status', 'filling')
    .neq('id', id)

  const hasRival = (competingSessions?.length ?? 0) > 0

  const { data: messages } = await supabase
    .from('messages')
    .select('id, content, created_at, user_id')
    .eq('session_id', id)
    .order('created_at', { ascending: true })
    .limit(100)

  return (
    <>
      <Nav />
      <SessionClient
        session={normalizedSession}
        hasRival={hasRival}
        initialMessages={messages ?? []}
        justJoined={joined === '1'}
        justCreated={created === '1'}
        alreadyIn={already === '1' || !!memberRow}
      />
    </>
  )
}
