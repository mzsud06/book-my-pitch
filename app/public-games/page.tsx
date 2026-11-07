import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { GameCard } from '@/components/GameCard'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
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

function typeLabelFromVariant(variant: 'peak' | 'offpeak' | 'weekend'): string {
  return variant === 'peak' ? 'Peak' : variant === 'offpeak' ? 'Off-peak' : 'Weekend'
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
  const { data: rawGames } = await createServiceClient()
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
        time: `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`,
        date: fmtSlotDate(slot.date),
        price: `£${(slot.price / maxPlayers).toFixed(2)}`,
        playerCount,
        maxPlayers,
        type,
        badgeVariant: (type === 'peak' ? 'peak' : type === 'weekend' ? 'weekend' : 'offpeak') as 'peak' | 'offpeak' | 'weekend',
      }
    })
    .sort((a, b) => Number(a.isFull) - Number(b.isFull) || b.playerCount - a.playerCount)

  return (
    <>
      <Nav />
      <main style={{ position: 'relative', zIndex: 1 }}>
        <Container>
          <div style={{ paddingTop: 'clamp(2.5rem, 6vh, 3.5rem)', paddingBottom: 'clamp(4rem, 8vh, 6rem)' }}>

            {/* Page header */}
            <div className="anim-fade-up" style={{ marginBottom: '2.5rem', maxWidth: '640px' }}>
              <SectionHeading
                eyebrow="Open games"
                heading="Squads filling now"
                sub="Join a game that's already filling up, no organising needed."
              />
            </div>

            {games.length === 0 ? (
              /* Empty state */
              <Card
                className="anim-fade-up d-100"
                style={{ textAlign: 'center', padding: '4rem 1.5rem' }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    background: 'rgba(255,79,26,0.08)',
                    border: '1px solid rgba(255,79,26,0.15)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    fontSize: '28px',
                  }}
                >
                  ⚽
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)', fontStretch: '75%',
                    fontSize: '22px',
                    letterSpacing: '-0.03em',
                    marginBottom: '0.6rem',
                    color: 'var(--text)',
                  }}
                >
                  No public games right now
                </div>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '2rem', fontWeight: 500, lineHeight: 1.6 }}>
                  Check back soon or start your own.
                </div>
                <Link href="/slots" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="lg" arrow>Browse slots</Button>
                </Link>
              </Card>
            ) : (
              <div className="public-games-grid public-games-grid--3">
                {games.map((game, idx) => (
                  <div key={game.id} className="anim-fade-up" style={{ animationDelay: `${Math.min(idx, 8) * 60}ms` }}>
                    <GameCard
                      href={`/session/${game.id}`}
                      photo={idx % 2 === 0 ? '/example-pitch.jpg' : '/game-card.jpg'}
                      title={game.organiserName ? `${game.organiserName}'s game` : 'Public game'}
                      venue={game.venueName}
                      area={game.venueAddress}
                      date={game.date}
                      time={game.time.split(' – ')[0]}
                      price={game.price}
                      filled={game.playerCount}
                      total={game.maxPlayers}
                      format={`${game.maxPlayers / 2}-a-side`}
                      isFull={game.isFull}
                      badge={<Badge variant={game.badgeVariant}>{typeLabelFromVariant(game.badgeVariant)}</Badge>}
                    />
                  </div>
                ))}
              </div>
            )}

          </div>
        </Container>
      </main>
    </>
  )
}
