import Link from 'next/link'
import type { ReactNode } from 'react'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { GameCard, type GameCardData } from '@/components/GameCard'
import { VenueCard, type VenueCardData } from '@/components/VenueCard'
import { FaqAccordion } from '@/components/FaqAccordion'

const TICKER = ["Nobody pays till it's full", 'Share one link', 'Split the cost automatically', 'Floodlit pitches', '5-a-side and 7-a-side', 'East London']

const FEATURES: { title: string; body: string; href: string; icon: ReactNode }[] = [
  {
    title: 'Book a pitch',
    body: 'Pick a pitch and a game time. Nobody pays until the game is full.',
    href: '/slots',
    icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14M3 9.5h3v5H3M21 9.5h-3v5h3" /><circle cx="12" cy="12" r="2.2" /></>,
  },
  {
    title: 'Start a game',
    body: 'Share one link in your group chat. Mates join and save a card.',
    href: '/slots',
    icon: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  },
  {
    title: 'Join a game',
    body: 'Short of a game? Jump into an open one and fill a space.',
    href: '/public-games',
    icon: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M17 8v6M14 11h6" /></>,
  },
  {
    title: 'For venues',
    body: 'Run a pitch? List it, set your price and get paid in full when games fill.',
    href: '/list-your-venue',
    icon: <><path d="M3 21V9l9-5 9 5v12" /><path d="M9 21v-6h6v6" /></>,
  },
]

function Ball() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z" />
    </svg>
  )
}

function Contours() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <g fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2">
        <path d="M-50 420C200 340 380 520 620 430S980 220 1260 300" />
        <path d="M-50 470C220 390 400 570 640 480S1000 270 1260 350" />
        <path d="M-50 520C240 440 420 620 660 530S1020 320 1260 400" />
        <path d="M700 -20c120 140 60 260 200 330s300 20 360 140" />
        <path d="M760 -20c120 140 60 260 200 330s260 20 320 140" />
        <ellipse cx="1040" cy="420" rx="120" ry="70" />
        <ellipse cx="1040" cy="420" rx="70" ry="38" />
      </g>
    </svg>
  )
}

export interface HomeViewProps {
  games: GameCardData[]
  venues: VenueCardData[]
  venuesFailed: boolean
}

export function HomeView({ games, venues, venuesFailed }: HomeViewProps) {
  return (
    <main>
      {/* Hero */}
      <section style={{ paddingTop: 'clamp(1rem, 3vw, 2rem)' }}>
        <Container>
          <div className="home-hero" style={{ position: 'relative', overflow: 'hidden', background: 'var(--green)', borderRadius: 'var(--radius-2xl)', color: '#FFFFFF' }}>
            <Contours />
            <div style={{ position: 'relative', maxWidth: '640px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', color: 'var(--green)', borderRadius: '999px', padding: '8px 16px', fontSize: '14px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                <Ball /> 5-a-side · East London
              </span>
              <h1 style={{ fontSize: 'var(--text-hero)', color: '#FFFFFF', margin: '1.25rem 0 1rem' }}>
                Ready to <span style={{ color: 'var(--acid)' }}>play?</span>
              </h1>
              <p style={{ fontSize: 'clamp(1.05rem, 2.2vw, 1.25rem)', lineHeight: 1.55, color: 'rgba(255,255,255,0.9)', margin: '0 0 2rem', maxWidth: '46ch' }}>
                Pick a pitch, send one link and your mates join. Nobody pays until the game is full, then everyone pays their share automatically.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                <Link href="/slots" style={{ textDecoration: 'none' }}>
                  <Button size="lg" arrow>Book a pitch</Button>
                </Link>
                <Link href="/public-games" style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '16px', display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>
                  Or join a game
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Ticker */}
      <div className="ticker" aria-label="Why BookMyPitch" role="region" style={{ marginTop: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
        <div className="ticker-track">
          {[0, 1].map(copy => (
            <ul key={copy} className="ticker-list" aria-hidden={copy === 1}>
              {TICKER.map(t => <li key={t}><Ball />{t}</li>)}
            </ul>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="home-section">
        <Container>
          <SectionHeading eyebrow="How it works" heading="One link. Full game." sub="Everything happens in one place, from booking the pitch to everyone paying their share." />
          <div className="feature-grid">
            {FEATURES.map((f, i) => {
              const filled = i === 0
              return (
                <Link key={f.title} href={f.href} className="feature-card" style={{ textDecoration: 'none', background: filled ? 'var(--green)' : '#FFFFFF', color: filled ? '#FFFFFF' : 'var(--text)' }}>
                  <span style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: filled ? 'rgba(255,255,255,0.18)' : 'var(--green-faint)' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={filled ? '#FFFFFF' : 'var(--green)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{f.icon}</svg>
                  </span>
                  <h3 style={{ fontSize: '1.375rem', margin: '1.25rem 0 0.5rem', color: 'inherit' }}>{f.title}</h3>
                  <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.55, color: filled ? 'rgba(255,255,255,0.88)' : 'var(--text-secondary)' }}>{f.body}</p>
                  <span style={{ marginTop: 'auto', paddingTop: '1.5rem', fontWeight: 800, fontSize: '17px', color: filled ? 'var(--acid)' : 'var(--green)' }}>Get started →</span>
                </Link>
              )
            })}
          </div>
        </Container>
      </section>

      {/* Open games */}
      <section className="home-section">
        <Container>
          <SectionHeading
            eyebrow="Open games"
            heading="Games with spaces"
            action={<Link href="/public-games" className="section-link">View all games →</Link>}
          />
          <div className="card-grid">
            {games.length > 0 ? (
              games.map(g => <GameCard key={g.id} game={g} />)
            ) : (
              <div className="empty-card">
                <h3 style={{ fontSize: '1.3rem', margin: 0 }}>No open games yet</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '40ch' }}>Start one and make it public. It shows up here for anyone to join.</p>
                <Link href="/slots" style={{ textDecoration: 'none' }}><Button variant="brand">Start a game</Button></Link>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Pitches */}
      <section className="home-section">
        <Container>
          <SectionHeading
            eyebrow="Pitches"
            heading="Book a pitch"
            action={<Link href="/slots" className="section-link">View all pitches →</Link>}
          />
          <div className="card-grid">
            {venuesFailed ? (
              <div className="empty-card">
                <h3 style={{ fontSize: '1.3rem', margin: 0 }}>We couldn&apos;t load the pitches</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>That&apos;s on our side. Refresh the page in a moment.</p>
                <Link href="/" style={{ textDecoration: 'none' }}><Button variant="secondary">Refresh</Button></Link>
              </div>
            ) : venues.length === 0 ? (
              <div className="empty-card">
                <h3 style={{ fontSize: '1.3rem', margin: 0 }}>No pitches open right now</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>New venues are checked before they go live.</p>
                <a href="mailto:masud@bookmypitch.uk?subject=Tell me when pitches open" style={{ textDecoration: 'none' }}><Button variant="secondary">Tell me when pitches open</Button></a>
              </div>
            ) : (
              venues.map(v => <VenueCard key={v.id} venue={v} />)
            )}
          </div>
        </Container>
      </section>

      {/* Trust */}
      <section className="home-section">
        <Container>
          <div className="trust-card">
            <div>
              <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>What happens to your card</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                You save a card to hold your place. You&apos;re only charged when the game fills. If it doesn&apos;t fill, nothing is taken. Stripe handles card details, so we never see them.{' '}
                <Link href="/terms" style={{ color: 'var(--green)', fontWeight: 700 }}>Read the terms</Link>
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>Who runs this</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                BookMyPitch is run by Masud Rahman, Admin. Questions first? Email{' '}
                <a href="mailto:masud@bookmypitch.uk" style={{ color: 'var(--green)', fontWeight: 700 }}>masud@bookmypitch.uk</a>.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Venues */}
      <section className="home-section">
        <Container>
          <div className="venue-cta" style={{ background: 'var(--ink)', color: '#FFFFFF', borderRadius: 'var(--radius-2xl)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', maxWidth: '560px' }}>
              <h2 style={{ fontSize: 'var(--text-h2)', margin: '0 0 0.75rem', color: '#FFFFFF' }}>Run a <span style={{ color: 'var(--acid)' }}>pitch?</span></h2>
              <p style={{ margin: '0 0 1.5rem', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.85)' }}>
                Set your own price and fill quiet hours. You&apos;re paid in full through Stripe when a game confirms. No contract.
              </p>
              <Link href="/list-your-venue" style={{ textDecoration: 'none' }}><Button size="lg" arrow>List your pitch</Button></Link>
            </div>
          </div>
        </Container>
      </section>

      <FaqAccordion />
    </main>
  )
}
