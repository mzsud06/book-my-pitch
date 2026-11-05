import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { StateMessage } from '@/components/ui/StateMessage'
import { Footer } from '@/components/Footer'
import { createServiceClient } from '@/lib/supabase/service'
import { getSlotType, isSlotInPast, scheduleFromVenue, VenueSchedule } from '@/lib/slots'
import { expireIfStale } from '@/lib/expireSessions'

export const revalidate = 0

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function PeopleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 13c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11.5" cy="5.5" r="1.7" stroke="currentColor" strokeWidth="1.3" opacity="0.75" />
      <path d="M9.8 9.6c1.8.2 3.2 1.5 3.2 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6V8l2.6 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 14.5s5-4.2 5-8.2A5 5 0 0 0 3 6.3c0 4 5 8.2 5 8.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="6.3" r="1.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

type GameVenue = Partial<VenueSchedule> & { name: string; address: string }

interface PublicGameRow {
  id: string
  organiser_name: string | null
  status: string
  slots: {
    date: string
    start_time: string
    end_time: string
    price: number
    pitches: { max_players: number }
    venues: GameVenue | GameVenue[] | null
  }
  players: { count: number }[]
}

export default async function PublicGamesPage() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawGames, error: gamesError } = await createServiceClient()
    .from('sessions')
    .select('id, organiser_name, status, slots!inner(date, start_time, end_time, price, pitches(max_players), venues(name, address, opening_time, closing_time, weekend_opening_time, weekend_closing_time, peak_start_time, daily_hours)), players(count)')
    .eq('game_type', 'open')
    .in('status', ['filling', 'confirmed'])
    .eq('is_public', true)
    .gte('slots.date', today)

  const allGames = (rawGames as unknown as PublicGameRow[]) ?? []

  // A 'filling' game whose slot has already started is stale — nothing sweeps
  // it automatically until someone happens to visit its session page, so
  // without this it would keep showing here as "live" for anyone browsing.
  // Sweep those (flips their DB status) and drop them from the list.
  const staleFilling = allGames.filter(s => {
    const slot = Array.isArray(s.slots) ? s.slots[0] : s.slots
    return s.status === 'filling' && isSlotInPast(slot.date, slot.start_time)
  })
  if (staleFilling.length > 0) {
    await Promise.all(staleFilling.map(s => {
      const slot = Array.isArray(s.slots) ? s.slots[0] : s.slots
      return expireIfStale(s.id, slot.date, slot.start_time)
    }))
  }
  const staleIds = new Set(staleFilling.map(s => s.id))

  const games = allGames
    .filter(s => !staleIds.has(s.id))
    .map(s => {
      const slot = Array.isArray(s.slots) ? s.slots[0] : s.slots
      const rawVenue = slot.venues
      const venue = Array.isArray(rawVenue) ? rawVenue[0] : rawVenue
      const playerCount = (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
      const maxPlayers = slot.pitches.max_players
      const type = getSlotType(slot.date, slot.start_time, scheduleFromVenue(venue))
      return {
        id: s.id,
        organiserName: s.organiser_name,
        isFull: s.status === 'confirmed' || playerCount >= maxPlayers,
        venueName: venue?.name ?? 'your local pitch',
        venueAddress: venue?.address ?? '',
        time: `${slot.start_time.slice(0, 5)} to ${slot.end_time.slice(0, 5)}`,
        sortKey: `${slot.date} ${slot.start_time}`,
        date: fmtSlotDate(slot.date),
        price: `£${(slot.price / maxPlayers).toFixed(2)}`,
        playerCount,
        maxPlayers,
        type,
        badgeVariant: (type === 'peak' ? 'peak' : type === 'weekend' ? 'weekend' : 'offpeak') as 'peak' | 'offpeak' | 'weekend',
      }
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <>
      <Nav />
      <main>
        <Container>
          <div style={{ paddingTop: 'clamp(2rem, 6vh, 3.5rem)' }}>
            <div style={{ marginBottom: '2rem', maxWidth: '640px' }}>
              <SectionHeading heading="Public games" sub="Games anyone can join, in date order. Join one and save a card. You are charged only when the game fills." />
            </div>
            {gamesError ? (
              <StateMessage
                tone="error"
                title="We couldn't load the games"
                body="That's on our side, not yours. Refresh the page in a moment."
                action={<Link href="/public-games" style={{ textDecoration: 'none' }}><Button variant="secondary">Refresh</Button></Link>}
              />
            ) : games.length === 0 ? (
              <StateMessage
                title="No public games yet"
                body="Be the first. Pick a pitch and a time, then choose to make your game public so others can join."
                action={<Link href="/slots" style={{ textDecoration: 'none' }}><Button size="lg" arrow>Start a game</Button></Link>}
              />
            ) : (
              <div className="public-games-grid">
                {games.map(game => {
                  const inner = (
                    <Card hover={!game.isFull} style={{ padding: '1.25rem', height: '100%', opacity: game.isFull ? 0.65 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                        <ClockIcon /> {game.date}, {game.time}
                      </div>
                      <h3 style={{ fontSize: '1.25rem', margin: '0.4rem 0 0.2rem', lineHeight: 1.25 }}>
                        {game.organiserName ? `${game.organiserName}'s game` : 'Public game'}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        <PinIcon /> {game.venueName}{game.venueAddress ? `, ${game.venueAddress}` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '1rem' }}>
                          <PeopleIcon /> {game.isFull ? 'Full' : `${game.playerCount} of ${game.maxPlayers} joined`}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--green)' }}>{game.price} a player, plus fees</span>
                      </div>
                    </Card>
                  )
                  return game.isFull ? (
                    <div key={game.id}>{inner}</div>
                  ) : (
                    <Link key={game.id} href={`/session/${game.id}`} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
                  )
                })}
              </div>
            )}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  )
}
