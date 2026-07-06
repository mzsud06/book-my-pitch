import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import SessionClient from './SessionClient'
import { combineSlots } from '@/lib/slots'

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
  team_name: string | null
  game_type: string | null
  matched_session_id: string | null
  is_public: boolean
  slot_ids: string[] | null
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
        id, status, created_at, organiser_name, organiser_phone, organiser_id, team_name, game_type, matched_session_id, is_public, slot_ids,
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

  // Multi-hour (60/120/180 min) bookings span several slot rows — combine them
  // so the displayed time range and price reflect the whole booking, e.g.
  // "18:30 – 20:30" and the summed pitch price, not just the first hour.
  const sessionSlotIds = (rawSession as unknown as { slot_ids: string[] | null }).slot_ids
  const multiHourIds = sessionSlotIds && sessionSlotIds.length > 1 ? sessionSlotIds : null
  let combinedRange: { start_time: string; end_time: string; price: number } = {
    start_time: (slot as SessionData['slots']).start_time,
    end_time: (slot as SessionData['slots']).end_time,
    price: (slot as SessionData['slots']).price,
  }
  if (multiHourIds) {
    const { data: allSlotRows } = await supabase
      .from('slots')
      .select('id, date, start_time, end_time, price, max_players')
      .in('id', multiHourIds)
    if (allSlotRows && allSlotRows.length > 0) {
      const combined = combineSlots(allSlotRows as unknown as { id: string; date: string; start_time: string; end_time: string; price: number; max_players: number }[])
      combinedRange = { start_time: combined.start_time, end_time: combined.end_time, price: combined.price }
    }
  }

  const normalizedSession: SessionData = {
    id: rawSession.id,
    status: rawSession.status,
    created_at: rawSession.created_at,
    organiser_name: (rawSession as unknown as { organiser_name: string | null }).organiser_name ?? null,
    organiser_phone: (rawSession as unknown as { organiser_phone: string | null }).organiser_phone ?? null,
    organiser_id: (rawSession as unknown as { organiser_id: string | null }).organiser_id ?? null,
    team_name: (rawSession as unknown as { team_name: string | null }).team_name ?? null,
    game_type: (rawSession as unknown as { game_type: string | null }).game_type ?? null,
    matched_session_id: (rawSession as unknown as { matched_session_id: string | null }).matched_session_id ?? null,
    is_public: (rawSession as unknown as { is_public: boolean }).is_public ?? false,
    slot_ids: sessionSlotIds ?? null,
    slots: {
      ...(slot as SessionData['slots']),
      ...combinedRange,
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
    .select('id, content, created_at, user_id, sender_name')
    .eq('session_id', id)
    .order('created_at', { ascending: true })
    .limit(100)

  let matchedSession: { id: string; team_name: string | null; status: string; players: { count: number }[] } | null = null
  if (normalizedSession.matched_session_id) {
    const { data: matchedData } = await supabase
      .from('sessions')
      .select('id, team_name, status, players(count)')
      .eq('id', normalizedSession.matched_session_id)
      .single()
    if (matchedData) {
      matchedSession = matchedData as unknown as typeof matchedSession
    }
  } else if (normalizedSession.game_type === 'looking_for_opposition') {
    // Unclaimed LFO: find the earliest active challenger so the LFO organiser
    // can see the opposing team forming before the race-claim fires.
    const { data: challengerData } = await supabase
      .from('sessions')
      .select('id, team_name, status, players(count)')
      .eq('matched_session_id', id)
      .eq('status', 'filling')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (challengerData) {
      matchedSession = challengerData as unknown as typeof matchedSession
    }
  }

  return (
    <>
      <Nav />
      <SessionClient
        session={normalizedSession}
        hasRival={hasRival}
        initialMessages={messages ?? []}
        justJoined={joined === '1'}
        justCreated={created === '1'}
        alreadyIn={(already === '1' || !!memberRow) && user?.id !== normalizedSession.organiser_id}
        matchedSession={matchedSession}
      />
    </>
  )
}
