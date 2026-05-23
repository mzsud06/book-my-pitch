import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import SessionClient from './SessionClient'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ joined?: string; created?: string }>
}

interface SessionData {
  id: string
  status: string
  created_at: string
  organiser_name: string | null
  organiser_phone: string | null
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
  players: { id: string; name: string; joined_at: string }[]
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { id } = await params
  const { joined, created } = await searchParams
  const supabase = await createClient()

  const { data: rawSession } = await supabase
    .from('sessions')
    .select(`
      id, status, created_at, organiser_name, organiser_phone,
      slots(id, date, start_time, end_time, type, price, max_players,
        venues(id, name, address, stripe_account_id)
      ),
      players(id, name, joined_at)
    `)
    .eq('id', id)
    .single()

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
    slots: {
      ...(slot as SessionData['slots']),
      venues: venue as SessionData['slots']['venues'],
    },
    players: Array.isArray(rawSession.players)
      ? rawSession.players as SessionData['players']
      : [],
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
      />
    </>
  )
}
