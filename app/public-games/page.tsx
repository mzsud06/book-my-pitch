import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { createServiceClient } from '@/lib/supabase/service'
import { getSlotType } from '@/lib/slots'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

interface PublicGameRow {
  id: string
  organiser_name: string | null
  slots: {
    date: string
    start_time: string
    end_time: string
    price: number
    pitches: { max_players: number }
    venues: { name: string } | { name: string }[] | null
  }
  players: { count: number }[]
}

export default async function PublicGamesPage() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawGames } = await createServiceClient()
    .from('sessions')
    .select('id, organiser_name, slots!inner(date, start_time, end_time, price, pitches(max_players), venues(name)), players(count)')
    .eq('game_type', 'open')
    .eq('status', 'filling')
    .eq('is_public', true)
    .gte('slots.date', today)

  const games = ((rawGames as unknown as PublicGameRow[]) ?? [])
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
        venueName: venue?.name ?? 'your local pitch',
        time: `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`,
        date: fmtSlotDate(slot.date),
        price: `£${(slot.price / maxPlayers).toFixed(2)}`,
        playerCount,
        maxPlayers,
        type,
        badgeVariant: (type === 'peak' ? 'peak' : type === 'weekend' ? 'weekend' : 'offpeak') as 'peak' | 'offpeak' | 'weekend',
        typeLabel: type === 'peak' ? 'Peak' : type === 'offpeak' ? 'Off-peak' : 'Weekend',
      }
    })
    .sort((a, b) => b.playerCount - a.playerCount)

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
                sub="Join a game that's already filling up — no organising needed."
              />
            </div>

            {games.length === 0 ? (
              /* Empty state */
              <div
                className="anim-fade-up d-100"
                style={{
                  textAlign: 'center',
                  padding: '4rem 1.5rem',
                  background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '20px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
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
              </div>
            ) : (
              /* Game cards */
              <div className="public-games-grid">
                {games.map((game, idx) => {
                  const spotsLeft = game.maxPlayers - game.playerCount
                  return (
                    <Card
                      key={game.id}
                      className="anim-fade-up"
                      style={{ padding: '1.5rem', animationDelay: `${idx * 60}ms` }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem', gap: '8px' }}>
                        <Badge variant="public">Public game</Badge>
                        <Badge variant={game.badgeVariant}>{game.typeLabel}</Badge>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.1rem', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="tabular" style={{
                            fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700,
                            letterSpacing: '-0.015em', color: 'var(--text)', lineHeight: 1.15,
                          }}>
                            {game.time}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px' }}>
                            {game.date} · {game.venueName}
                          </div>
                        </div>
                        <div className="tabular" style={{
                          fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700,
                          color: 'var(--green)', lineHeight: 1, letterSpacing: '-0.01em', flexShrink: 0, textAlign: 'right' as const,
                        }}>
                          {game.price}
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: '2px' }}>
                            per player
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1.1rem' }}>
                        {game.organiserName ? `${game.organiserName}'s game` : "Public game"}
                      </div>

                      <div style={{
                        height: '4px', borderRadius: '99px',
                        background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '0.6rem',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(game.playerCount / game.maxPlayers) * 100}%`,
                          borderRadius: '99px',
                          background: 'var(--green)',
                          boxShadow: '0 0 6px rgba(198,241,53,0.35)',
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {game.playerCount}/{game.maxPlayers} players
                        </div>
                        {game.playerCount >= game.maxPlayers - 2 && (
                          <div style={{ fontSize: '12px', color: 'var(--amber)', fontWeight: 700 }}>
                            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                          </div>
                        )}
                      </div>

                      <Link href={`/session/${game.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <Button variant="primary" size="md" arrow style={{ width: '100%' }}>
                          Join
                        </Button>
                      </Link>
                    </Card>
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
