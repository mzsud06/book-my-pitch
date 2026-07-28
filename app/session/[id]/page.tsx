import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import SessionClient from './SessionClient'
import { combineSlots, Pitch } from '@/lib/slots'
import { expireIfStale } from '@/lib/expireSessions'

const PITCH_COLS = 'id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price'

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
  game_type: string | null
  is_public: boolean
  slot_ids: string[] | null
  slots: {
    id: string
    date: string
    start_time: string
    end_time: string
    price: number
    max_players: number
    pitches: Pitch
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
        id, status, created_at, organiser_name, organiser_phone, organiser_id, game_type, is_public, slot_ids,
        slots(id, date, start_time, end_time, price, max_players, pitches(${PITCH_COLS}),
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

  // A 'filling' session whose slot has already started never gets touched
  // again once nobody's left to join it — flip it to 'expired' on read so the
  // page (and everywhere else that cares about status) reflects reality.
  let sessionStatus = rawSession.status
  if (sessionStatus === 'filling') {
    const { date: slotDate, start_time: slotStartTime } = slot as unknown as { date: string; start_time: string }
    if (await expireIfStale(id, slotDate, slotStartTime)) {
      sessionStatus = 'expired'
    }
  }

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
      .select(`id, date, start_time, end_time, price, max_players, pitches(${PITCH_COLS})`)
      .in('id', multiHourIds)
    if (allSlotRows && allSlotRows.length > 0) {
      const combined = combineSlots(allSlotRows as unknown as { id: string; date: string; start_time: string; end_time: string; price: number; pitches: Pitch }[])
      combinedRange = { start_time: combined.start_time, end_time: combined.end_time, price: combined.price }
    }
  }

  const normalizedSession: SessionData = {
    id: rawSession.id,
    status: sessionStatus,
    created_at: rawSession.created_at,
    organiser_name: (rawSession as unknown as { organiser_name: string | null }).organiser_name ?? null,
    organiser_phone: (rawSession as unknown as { organiser_phone: string | null }).organiser_phone ?? null,
    organiser_id: (rawSession as unknown as { organiser_id: string | null }).organiser_id ?? null,
    game_type: (rawSession as unknown as { game_type: string | null }).game_type ?? null,
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
      />
    </>
  )
}
