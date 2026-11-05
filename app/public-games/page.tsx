import Link from 'next/link'
import Nav from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { GameCard } from '@/components/GameCard'
import { createServiceClient } from '@/lib/supabase/service'
import { isSlotInPast } from '@/lib/slots'
import { expireIfStale } from '@/lib/expireSessions'
import { loadPublicGames } from '@/lib/publicGames'

export const revalidate = 0

// A 'filling' game whose slot has already started is stale; nothing sweeps it
// until someone opens its session page, so sweep those here first (unchanged
// behaviour from the previous version of this page).
async function sweepStaleGames() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await createServiceClient()
      .from('sessions')
      .select('id, slots!inner(date, start_time)')
      .eq('game_type', 'open')
      .eq('is_public', true)
      .eq('status', 'filling')
      .gte('slots.date', today)
    type Row = { id: string; slots: { date: string; start_time: string } | { date: string; start_time: string }[] }
    const stale = ((data as unknown as Row[]) ?? [])
      .map(r => ({ id: r.id, slot: Array.isArray(r.slots) ? r.slots[0] : r.slots }))
      .filter(r => isSlotInPast(r.slot.date, r.slot.start_time))
    await Promise.all(stale.map(r => expireIfStale(r.id, r.slot.date, r.slot.start_time)))
  } catch {
    // Sweeping is best-effort; the list below already hides past games.
  }
}

export default async function PublicGamesPage() {
  await sweepStaleGames()
  const games = await loadPublicGames({ includeFull: true })

  return (
    <>
      <Nav />
      <main>
        <Container>
          <div style={{ paddingTop: 'clamp(2rem, 6vw, 3.5rem)' }}>
            <SectionHeading
              eyebrow="Open games"
              heading="Find a game"
              sub="Games anyone can join, soonest first. Save a card to hold your place. You're only charged when the game fills."
              action={<Link href="/slots" style={{ textDecoration: 'none' }}><Button variant="brand">Start a game</Button></Link>}
            />
            <div className="card-grid">
              {games === null ? (
                <div className="empty-card" role="alert">
                  <h3 style={{ fontSize: '1.3rem', margin: 0 }}>We couldn&apos;t load the games</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>That&apos;s on our side. Refresh the page in a moment.</p>
                  <Link href="/public-games" style={{ textDecoration: 'none' }}><Button variant="secondary">Refresh</Button></Link>
                </div>
              ) : games.length === 0 ? (
                <div className="empty-card">
                  <h3 style={{ fontSize: '1.3rem', margin: 0 }}>No open games yet</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '44ch' }}>Be the first. Pick a pitch and a time, then make your game public so others can join.</p>
                  <Link href="/slots" style={{ textDecoration: 'none' }}><Button variant="brand">Start a game</Button></Link>
                </div>
              ) : (
                games.map(g => <GameCard key={g.id} game={g} />)
              )}
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  )
}
