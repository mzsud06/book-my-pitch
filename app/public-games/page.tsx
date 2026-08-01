import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { createServiceClient } from '@/lib/supabase/service'
import { getSlotType, isSlotInPast } from '@/lib/slots'
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
    venues: { name: string; address: string } | { name: string; address: string }[] | null
  }
  players: { count: number }[]
}

export default async function PublicGamesPage() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawGames } = await createServiceClient()
    .from('sessions')
    .select('id, organiser_name, status, slots!inner(date, start_time, end_time, price, pitches(max_players), venues(name, address)), players(count)')
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
      const type = getSlotType(slot.date, slot.start_time)
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
                eyebrow="Live now"
                heading="Public games"
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
                    background: 'rgba(198,241,53,0.08)',
                    border: '1px solid rgba(198,241,53,0.15)',
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
                    fontFamily: 'var(--font-display)',
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
              /* Game cards — same visual treatment as the homepage's "Live now" preview */
              <div className="public-games-grid">
                {games.map((game, idx) => {
                  const cardInner = (
                    <Card
                      hover={!game.isFull}
                      style={{
                        padding: 0,
                        overflow: 'hidden',
                        height: '100%',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        opacity: game.isFull ? 0.6 : 1,
                      }}
                    >
                      {/* Top half — pitch photo */}
                      <div
                        style={{
                          position: 'relative', height: '180px',
                          backgroundImage: 'url(/example-pitch.jpg)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,8,0.4)' }} />
                        <div
                          style={{
                            position: 'absolute', top: '10px', left: '10px',
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: 'var(--radius-full)',
                            background: game.isFull ? 'var(--red)' : '#C6F135',
                            color: game.isFull ? '#fff' : '#080808',
                            fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
                            letterSpacing: '0.02em',
                          }}
                        >
                          <PeopleIcon /> {game.playerCount}/{game.maxPlayers} players
                        </div>
                      </div>

                      {/* Bottom half — game details */}
                      <div style={{ background: '#0e0e0e', padding: '1rem 1.2rem' }}>
                        <div style={{
                          fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                          letterSpacing: '-0.01em', color: '#fff', lineHeight: 1.2, marginBottom: '6px',
                        }}>
                          {game.organiserName ? `${game.organiserName}'s game` : "Public game"}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          fontFamily: 'var(--font-sans)', fontSize: '12px',
                          color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px',
                        }}>
                          <ClockIcon /> {game.date} · {game.time}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          fontFamily: 'var(--font-sans)', fontSize: '12px',
                          color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.9rem',
                        }}>
                          <PinIcon /> {game.venueName}{game.venueAddress ? ` · ${game.venueAddress}` : ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <Badge variant={game.badgeVariant}>{typeLabelFromVariant(game.badgeVariant)}</Badge>
                          <div style={{
                            display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                            padding: '5px 12px', borderRadius: 'var(--radius-full)',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>
                              {game.price}
                            </span>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--green)', opacity: 0.85 }}>
                              per player
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )

                  return game.isFull ? (
                    <div
                      key={game.id}
                      className="anim-fade-up"
                      style={{ animationDelay: `${idx * 60}ms`, cursor: 'default' }}
                    >
                      {cardInner}
                    </div>
                  ) : (
                    <Link
                      key={game.id}
                      href={`/session/${game.id}`}
                      className="anim-fade-up"
                      style={{ animationDelay: `${idx * 60}ms`, textDecoration: 'none', display: 'block' }}
                    >
                      {cardInner}
                    </Link>
                  )
                })}
              </div>
            )}

          </div>
        </Container>
      </main>
    </>
  )
}
