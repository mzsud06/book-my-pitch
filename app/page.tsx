import Nav from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { HomeView } from '@/components/home/HomeView'
import type { GameCardData } from '@/components/GameCard'
import type { VenueCardData } from '@/components/VenueCard'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { perPlayerBreakdown } from '@/lib/feeDisplay'
import { shortDate } from '@/lib/labels'

export const revalidate = 0

type GameVenue = { name: string; address: string; photo_url: string | null }
type GameSlot = {
  id: string; date: string; start_time: string; end_time: string; price: number
  pitches: { max_players: number; format: string; surface: string } | null
  venues: GameVenue | GameVenue[] | null
}
type GameRow = {
  id: string
  status: string
  organiser_name: string | null
  slot_ids: string[] | null
  slots: GameSlot | GameSlot[]
  players: { count: number }[]
}

// Real public games only, soonest first. Shows games that still have spaces;
// a confirmed (full) game drops off the homepage.
async function loadGames(): Promise<GameCardData[]> {
  try {
    const svc = createServiceClient()
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await svc
      .from('sessions')
      .select('id, status, organiser_name, slot_ids, slots!inner(id, date, start_time, end_time, price, pitches(max_players, format, surface), venues(name, address, photo_url)), players(count)')
      .eq('game_type', 'open')
      .eq('is_public', true)
      .eq('status', 'filling')
      .gte('slots.date', today)
    if (error || !data) return []
    const rows = data as unknown as GameRow[]

    // Multi-hour games span several slot rows; the charge is their combined
    // price (see lib/triggerPayments.ts), so fetch every slot's price.
    const extraIds = Array.from(new Set(rows.flatMap(r => (r.slot_ids && r.slot_ids.length > 1 ? r.slot_ids : []))))
    const priceById = new Map<string, number>()
    if (extraIds.length > 0) {
      const { data: extra } = await svc.from('slots').select('id, price').in('id', extraIds)
      ;(extra ?? []).forEach((s: { id: string; price: number }) => priceById.set(s.id, s.price))
    }

    const now = new Date()
    return rows
      .map(r => {
        const slot = Array.isArray(r.slots) ? r.slots[0] : r.slots
        const venue = Array.isArray(slot.venues) ? slot.venues[0] : slot.venues
        const maxPlayers = slot.pitches?.max_players ?? 10
        const playerCount = r.players?.[0]?.count ?? 0
        const ids = r.slot_ids && r.slot_ids.length > 1 ? r.slot_ids : [slot.id]
        const totalPrice = ids.length > 1 ? ids.reduce((sum, id) => sum + (priceById.get(id) ?? slot.price), 0) : slot.price
        const endHour = Number(slot.start_time.slice(0, 2)) + ids.length
        const endTime = ids.length > 1 ? `${String(endHour).padStart(2, '0')}:${slot.start_time.slice(3, 5)}` : slot.end_time.slice(0, 5)
        return {
          start: new Date(`${slot.date}T${slot.start_time}`),
          card: {
            id: r.id,
            title: r.organiser_name ? `${r.organiser_name}'s game` : 'Open game',
            dateLabel: shortDate(slot.date),
            timeLabel: `${slot.start_time.slice(0, 5)} to ${endTime}`,
            venueName: venue?.name ?? 'Local pitch',
            venueAddress: venue?.address,
            photoUrl: venue?.photo_url ?? null,
            pricePerPlayer: perPlayerBreakdown(totalPrice / maxPlayers).total,
            playerCount,
            maxPlayers,
            format: slot.pitches?.format,
            surface: slot.pitches?.surface,
            durationMins: ids.length * 60,
            isFull: playerCount >= maxPlayers,
          } satisfies GameCardData,
        }
      })
      .filter(g => g.start > now && !g.card.isFull)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 4)
      .map(g => g.card)
  } catch {
    return []
  }
}

async function loadVenues(): Promise<{ venues: VenueCardData[]; failed: boolean }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('venues')
      .select('id, name, address, photo_url, pitches(format, surface, offpeak_price, max_players)')
      .eq('stripe_onboarding_complete', true)
      .eq('admin_approved', true)
      .order('created_at', { ascending: true })
      .limit(4)
    if (error) return { venues: [], failed: true }
    return { venues: (data ?? []) as unknown as VenueCardData[], failed: false }
  } catch {
    return { venues: [], failed: true }
  }
}

export default async function HomePage() {
  const [games, { venues, failed }] = await Promise.all([loadGames(), loadVenues()])
  return (
    <>
      <Nav />
      <HomeView games={games} venues={venues} venuesFailed={failed} />
      <Footer />
    </>
  )
}
