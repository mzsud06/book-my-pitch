import Link from 'next/link'
import Nav from '@/components/Nav'
import PageReveal from '@/components/PageReveal'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { StateMessage } from '@/components/ui/StateMessage'
import { VenueCard, type VenueCardData } from '@/components/VenueCard'
import { FaqAccordion } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'
import { PLATFORM_FEE_PENCE_DISPLAY, PAYMENT_FEE_PENCE_DISPLAY } from '@/lib/feeDisplay'

export const revalidate = 0

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

const STEPS = [
  { title: 'Pick a pitch and a time', body: 'Choose a pitch and game time that works for your group.' },
  { title: 'Share one link', body: 'Send it to your group chat. No sign-up needed to look.' },
  { title: 'Mates join and save a card', body: 'Saving a card holds their place. Nothing is charged yet.' },
  { title: 'The game fills, everyone pays', body: 'When the last place goes, everyone is charged automatically and the pitch is confirmed.' },
]

type GameVenue = { name: string; address: string }
type LiveGameRow = {
  id: string
  status: string
  slots: {
    date: string; start_time: string; end_time: string; price: number
    pitches: { max_players: number }
    venues: GameVenue | GameVenue[] | null
  } | { date: string }[]
  players: { count: number }[]
}

async function loadPublicGames() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await createServiceClient()
      .from('sessions')
      .select('id, status, slots!inner(date, start_time, end_time, price, pitches(max_players), venues(name, address)), players(count)')
      .eq('game_type', 'open')
      .in('status', ['filling', 'confirmed'])
      .eq('is_public', true)
      .gte('slots.date', today)
    return ((data as unknown as LiveGameRow[]) ?? [])
      .map(s => {
        const slot = (Array.isArray(s.slots) ? s.slots[0] : s.slots) as Exclude<LiveGameRow['slots'], { date: string }[]>
        const venue = Array.isArray(slot.venues) ? slot.venues[0] : slot.venues
        const playerCount = (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
        const maxPlayers = slot.pitches.max_players
        return {
          id: s.id,
          sortKey: `${slot.date} ${slot.start_time}`,
          isFull: s.status === 'confirmed' || playerCount >= maxPlayers,
          venueName: venue?.name ?? 'Local pitch',
          time: `${slot.start_time.slice(0, 5)} to ${slot.end_time.slice(0, 5)}`,
          date: fmtSlotDate(slot.date),
          price: `£${(slot.price / maxPlayers).toFixed(2)}`,
          playerCount,
          maxPlayers,
        }
      })
      .filter(g => !g.isFull)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(0, 3)
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
    if (error) return { venues: [], failed: true }
    return { venues: (data ?? []) as unknown as VenueCardData[], failed: false }
  } catch {
    return { venues: [], failed: true }
  }
}

export default async function HomePage() {
  const [games, { venues, failed }] = await Promise.all([loadPublicGames(), loadVenues()])

  return (
    <PageReveal>
      <Nav />
      <main>
        {/* Hero: one promise, one button */}
        <section style={{ paddingTop: 'clamp(2.5rem, 8vh, 5rem)', paddingBottom: 'clamp(2.5rem, 7vh, 4.5rem)' }}>
          <Container>
            <div style={{ maxWidth: '720px' }}>
              <p style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--green)' }}>
                5-a-side and 7-a-side football in East London
              </p>
              <h1 style={{ fontSize: 'var(--text-hero)', lineHeight: 1.08, margin: '0 0 1.25rem', color: 'var(--text)' }}>
                Book a pitch. Send one link. Nobody pays until the game is full.
              </h1>
              <p style={{ fontSize: '1.125rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 2rem', maxWidth: '56ch' }}>
                Your mates join and save a card. When the game fills, everyone pays automatically and the pitch is confirmed. If it doesn&apos;t fill, nobody is charged.
              </p>
              <Link href="/slots" style={{ textDecoration: 'none', display: 'inline-block' }}>
                <Button size="lg" arrow>Book a pitch</Button>
              </Link>
              <p style={{ margin: '1rem 0 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                Each player pays their share of the pitch, a {PLATFORM_FEE_PENCE_DISPLAY}p booking fee and a {PAYMENT_FEE_PENCE_DISPLAY}p payment fee.
              </p>
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section id="how-it-works" style={{ paddingBottom: 'clamp(2.5rem, 7vh, 4.5rem)' }}>
          <Container>
            <SectionHeading heading="How it works" />
            <ol className="home-steps" style={{ listStyle: 'none', padding: 0, margin: '1.75rem 0 0' }}>
              {STEPS.map((step, i) => (
                <li key={step.title} style={{ borderTop: '2px solid var(--text)', paddingTop: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--green)', lineHeight: 1, marginBottom: '0.5rem' }}>{i + 1}</div>
                  <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.4rem', lineHeight: 1.25 }}>{step.title}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>{step.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* Venues (real, approved venues only) */}
        <section style={{ paddingBottom: 'clamp(2.5rem, 7vh, 4.5rem)' }}>
          <Container>
            <SectionHeading heading="Pitches you can book" />
            <div style={{ marginTop: '1.75rem' }}>
              {failed ? (
                <StateMessage
                  tone="error"
                  title="We couldn't load the pitches"
                  body="That's on our side. Try again in a moment."
                  action={<Link href="/" style={{ textDecoration: 'none' }}><Button variant="secondary">Try again</Button></Link>}
                />
              ) : venues.length === 0 ? (
                <StateMessage
                  title="No pitches are open for booking right now"
                  body="New venues are checked before they go live. Email us and we'll tell you when one opens."
                  action={<a href="mailto:masud@bookmypitch.uk?subject=Tell me when pitches open" style={{ textDecoration: 'none' }}><Button variant="secondary">Tell me when pitches open</Button></a>}
                />
              ) : (
                <div className="venue-grid">
                  {venues.map((v, i) => <VenueCard key={v.id} venue={v} index={i} />)}
                </div>
              )}
            </div>
          </Container>
        </section>

        {/* Public games: only when real ones exist */}
        {games.length > 0 && (
          <section style={{ paddingBottom: 'clamp(2.5rem, 7vh, 4.5rem)' }}>
            <Container>
              <SectionHeading heading="Games with spaces" sub="Open to anyone. Join one and save a card." />
              <div className="public-games-grid" style={{ marginTop: '1.75rem' }}>
                {games.map(g => (
                  <Link key={g.id} href={`/session/${g.id}`} style={{ textDecoration: 'none' }}>
                    <Card hover style={{ padding: '1.25rem' }}>
                      <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{g.date}, {g.time}</div>
                      <h3 style={{ fontSize: '1.25rem', margin: '0.25rem 0 0.75rem' }}>{g.venueName}</h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '1rem' }}>
                        <span>{g.playerCount} of {g.maxPlayers} joined</span>
                        <span style={{ fontWeight: 600 }}>{g.price} a player, plus fees</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
              <p style={{ margin: '1.25rem 0 0' }}>
                <Link href="/public-games" style={{ color: 'var(--green)', fontWeight: 600 }}>See all public games</Link>
              </p>
            </Container>
          </section>
        )}

        {/* Trust: who runs this + how card holds work */}
        <section style={{ paddingBottom: 'clamp(2.5rem, 7vh, 4.5rem)' }}>
          <Container>
            <div className="home-trust">
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.6rem' }}>What happens to your card</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  You save a card to hold your place. You are only charged when the game fills. If it doesn&apos;t fill, nothing is taken. Card details are handled by Stripe, so we never see them.{' '}
                  <Link href="/terms" style={{ color: 'var(--green)', fontWeight: 600 }}>Read the terms</Link>
                </p>
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.6rem' }}>Who runs this</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  BookMyPitch is run by Masud Rahman, Admin. If something looks wrong or you want to ask a question first, email{' '}
                  <a href="mailto:masud@bookmypitch.uk" style={{ color: 'var(--green)', fontWeight: 600 }}>masud@bookmypitch.uk</a>.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Venue owners: short, separate path */}
        <section style={{ paddingBottom: 'clamp(2.5rem, 7vh, 4.5rem)' }}>
          <Container>
            <div style={{ background: 'var(--green)', color: '#FFFFFF', borderRadius: 'var(--radius-xl)', padding: 'clamp(1.5rem, 5vw, 2.5rem)' }} className="home-venue-block">
              <div style={{ maxWidth: '52ch' }}>
                <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 0.5rem', color: '#FFFFFF' }}>Run a pitch?</h2>
                <p style={{ margin: 0, fontSize: '1.0625rem', color: 'rgba(255,255,255,0.9)' }}>
                  Set your own price and fill quiet hours. You are paid in full through Stripe when a game confirms. No contract.
                </p>
              </div>
              <Link href="/list-your-venue" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <Button variant="secondary" size="lg" style={{ background: '#FFFFFF', color: 'var(--green)', borderColor: '#FFFFFF' }}>For venues</Button>
              </Link>
            </div>
          </Container>
        </section>

        <FaqAccordion />
      </main>
      <Footer />
    </PageReveal>
  )
}
