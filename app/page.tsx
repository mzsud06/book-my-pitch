import Link from 'next/link'
import Image from 'next/image'
import Nav from '@/components/Nav'
import PageReveal from '@/components/PageReveal'
import { createServiceClient } from '@/lib/supabase/service'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FaqAccordion } from '@/components/FaqAccordion'

// ─── Image swap — edit these two spots when photos are ready ─────────
//
//  HERO BACKGROUND
//  Line 14 below. Set to a path, e.g. '/images/hero.jpg', to replace
//  the gradient glow with a full-bleed photo + dark overlay.
const HERO_IMAGE: string | null = '/hero-pitch.jpg'

//  CARD PHOTOS
//  Lines 33-35 below. Set each entry to swap in a card photo.
const PREVIEW_CARDS = [
  {
    image: null as string | null,   // swap → '/images/peak.jpg'
    badge: 'peak' as const,
    badgeLabel: 'Peak · Every day',
    time: '18:30 – 19:30',
    price: '£5.00',
    players: 8,
  },
  {
    image: null as string | null,   // swap → '/images/offpeak.jpg'
    badge: 'offpeak' as const,
    badgeLabel: 'Off-peak · Mon–Fri',
    time: '16:30 – 17:30',
    price: '£3.00',
    players: 4,
  },
  {
    image: null as string | null,   // swap → '/images/weekend.jpg'
    badge: 'neutral' as const,
    badgeLabel: 'Weekend',
    time: '09:30 – 10:30',
    price: '£4.00',
    players: 2,
  },
]
// ─────────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function typeLabelFromVariant(variant: 'peak' | 'offpeak' | 'neutral'): string {
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

const STATS = [
  { n: '10',  l: 'players needed' },
  { n: '£0',  l: 'charged until full' },
  { n: '4G',  l: 'all-weather pitch' },
]

const MARQUEE_ITEMS = [
  'No bank transfers',
  "Nobody pays till it's full",
  'All-weather 4G pitch',
  'Share one link',
  "£0 until the team's full",
]

export default async function HomePage() {
  // ── Fetch real public games (future dates only) ──────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawGames } = await createServiceClient()
    .from('sessions')
    .select('id, organiser_name, slots!inner(date, start_time, end_time, type, price), players(count)')
    .eq('game_type', 'open')
    .eq('status', 'filling')
    .eq('is_public', true)
    .gte('slots.date', today)

  type LiveGameRow = {
    id: string
    organiser_name: string | null
    slots: { date: string; start_time: string; end_time: string; type: string; price: number }
    players: { count: number }[]
  }

  const allPublicGames = ((rawGames as unknown as LiveGameRow[]) ?? [])
    .map(s => {
      const slot = Array.isArray(s.slots) ? s.slots[0] : s.slots
      const playerCount = (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
      const type = slot.type as 'peak' | 'offpeak' | 'weekend'
      return {
        id: s.id,
        organiserName: s.organiser_name,
        time: `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`,
        date: fmtSlotDate(slot.date),
        price: `£${(slot.price / 10).toFixed(2)}`,
        playerCount,
        type,
        badgeVariant: (type === 'peak' ? 'peak' : type === 'weekend' ? 'neutral' : 'offpeak') as 'peak' | 'offpeak' | 'neutral',
        badgeLabel: type === 'peak' ? 'Peak · Every day' : type === 'offpeak' ? 'Off-peak · Mon–Fri' : 'Weekend',
      }
    })
    .sort((a, b) => b.playerCount - a.playerCount)

  const liveGames = allPublicGames.slice(0, 3)

  const exampleCards = PREVIEW_CARDS.slice(0, Math.max(0, 3 - liveGames.length))

  // Compute plausible near-future dates for example cards (today, tomorrow, day after)
  const exampleDates = PREVIEW_CARDS.map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return fmtSlotDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  })
  // ──────────────────────────────────────────────────────────────────────

  return (
    <PageReveal>
      <Nav />
      <main style={{ position: 'relative', zIndex: 1 }}>

        {/* ============================================================
            HERO
            ============================================================ */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            paddingTop: 'clamp(4.5rem, 12vh, 7.5rem)',
            paddingBottom: 'clamp(3.5rem, 8vh, 5.5rem)',
          }}
        >
          {/* ── Background: gradient glow (null) or photo ── */}
          {/* Hero photo + layered overlay */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <Image
              src={HERO_IMAGE!}
              alt=""
              fill
              priority
              quality={85}
              sizes="100vw"
              style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
            />
            {/* Base layer — uniform dark so text is readable on mobile at any crop */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,8,0.42)' }} />
            {/* Directional layer — heavier at bottom (stats/CTA) and top (sky), lighter in centre (pitch/lights) */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.08) 45%, rgba(8,8,8,0.28) 100%)',
            }} />
          </div>

          {/* ── Hero content ── */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Container>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* Pill badge */}
                <div className="anim-fade-up d-0" style={{ marginBottom: '1.75rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 14px 6px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(22,48,31,0.5)',
                    border: '1px solid rgba(198,241,53,0.2)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    <span aria-hidden="true" style={{
                      width: '6px', height: '6px',
                      borderRadius: '50%',
                      background: 'var(--green)',
                      flexShrink: 0,
                      boxShadow: '0 0 6px rgba(198,241,53,0.65)',
                    }} />
                    Globe Pitch · Bethnal Green
                  </span>
                </div>

                {/* Headline */}
                <h1
                  className="anim-fade-up d-80"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-hero)',
                    lineHeight: 0.95,
                    letterSpacing: '-0.015em',
                    fontWeight: 700,
                    margin: '0 0 1.75rem',
                    color: 'var(--text)',
                  }}
                >
                  Play football tonight.
                </h1>

                {/* Subcopy */}
                <p
                  className="anim-fade-up d-220"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '17px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    maxWidth: '52ch',
                    margin: '0 0 2.25rem',
                    fontWeight: 400,
                  }}
                >
                  Find games near you or start one in under a minute.
                </p>

                {/* Primary CTA */}
                <div className="anim-fade-up d-300" style={{ marginBottom: '3.5rem' }}>
                  <Link href="/slots" style={{ textDecoration: 'none' }}>
                    <Button size="lg" arrow>Find a game tonight</Button>
                  </Link>
                </div>

                {/* Stat row */}
                <div
                  className="anim-fade-up d-380 hero-stats"
                  style={{
                    display: 'flex',
                    gap: 0,
                    borderTop: '1px solid var(--border)',
                    paddingTop: '2rem',
                    width: '100%',
                    maxWidth: '480px',
                  }}
                >
                  {STATS.map((item, idx) => (
                    <div
                      key={item.l}
                      style={{
                        flex: 1,
                        paddingLeft: idx > 0 ? '1.5rem' : 0,
                        paddingRight: idx < 2 ? '1.5rem' : 0,
                        borderLeft: idx > 0 ? '1px solid var(--border)' : 'none',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        className="tabular"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'clamp(28px, 4vw, 40px)',
                          color: 'var(--green)',
                          lineHeight: 1,
                          letterSpacing: '-0.015em',
                          fontWeight: 700,
                        }}
                      >
                        {item.n}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '9px',
                          color: 'var(--text-tertiary)',
                          marginTop: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          fontWeight: 600,
                        }}
                      >
                        {item.l}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </Container>
          </div>
        </section>

        {/* ============================================================
            VALUE MARQUEE
            ============================================================ */}
        <div
          className="marquee-strip"
          role="marquee"
          aria-label="Key features"
          style={{
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <div className="marquee-track">

            {/* First copy — visible to screen readers */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 0' }}>
              {MARQUEE_ITEMS.map((item, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    padding: '0 1.5rem',
                    whiteSpace: 'nowrap',
                  }}>
                    {item}
                  </span>
                  <span aria-hidden="true" style={{
                    color: 'var(--green)',
                    fontSize: '10px',
                    lineHeight: 1,
                    opacity: 0.75,
                    flexShrink: 0,
                  }}>
                    •
                  </span>
                </span>
              ))}
            </div>

            {/* Duplicate — aria-hidden, creates seamless loop */}
            <div className="marquee-dupe" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 0' }}>
              {MARQUEE_ITEMS.map((item, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    padding: '0 1.5rem',
                    whiteSpace: 'nowrap',
                  }}>
                    {item}
                  </span>
                  <span aria-hidden="true" style={{
                    color: 'var(--green)',
                    fontSize: '10px',
                    lineHeight: 1,
                    opacity: 0.75,
                    flexShrink: 0,
                  }}>
                    •
                  </span>
                </span>
              ))}
            </div>

          </div>
        </div>

        {/* ============================================================
            SLOT PREVIEW CARDS
            ============================================================ */}
        <section style={{ paddingTop: 'clamp(2.5rem, 5vh, 3.5rem)', paddingBottom: 'clamp(2.5rem, 5vh, 3.5rem)' }}>
          <Container>
            <div className="reveal-scroll" style={{ marginBottom: '1.75rem' }}>
              <SectionHeading
                eyebrow="Live now"
                heading="Public games"
              />
            </div>
          </Container>
          <div className="preview-cards-scroller">
            {/* ── Real public games ── */}
            {liveGames.map((game, idx) => (
              <Link
                key={game.id}
                href={`/session/${game.id}`}
                className="preview-card-link anim-fade-up"
                style={{ animationDelay: `${idx * 80}ms`, cursor: 'pointer' }}
              >
                <Card
                  hover
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    height: '100%',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {/* Top half — pitch photo placeholder */}
                  <div style={{ position: 'relative', height: '180px', background: '#111111' }}>
                    <div
                      style={{
                        position: 'absolute', top: '10px', left: '10px',
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                        background: game.playerCount >= 8 ? 'var(--green)' : 'rgba(0,0,0,0.6)',
                        color: game.playerCount >= 8 ? 'var(--black)' : '#fff',
                        fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
                        letterSpacing: '0.02em',
                      }}
                    >
                      <PeopleIcon /> {game.playerCount}/10 players
                    </div>
                  </div>

                  {/* Bottom half — game details */}
                  <div style={{ background: '#0e0e0e', padding: '1rem 1.2rem' }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                      letterSpacing: '-0.01em', color: '#fff', lineHeight: 1.2, marginBottom: '6px',
                    }}>
                      {game.organiserName ? `${game.organiserName}'s game` : "Someone's game"}
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
                      <PinIcon /> Globe Football Pitch · Bethnal Green
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
              </Link>
            ))}

            {/* ── Example / illustrative cards (fills remaining slots to 3) ── */}
            {exampleCards.map((card, i) => {
              const idx = liveGames.length + i
              return (
                <div
                  key={card.time}
                  className="preview-card-link anim-fade-up"
                  style={{ animationDelay: `${idx * 80}ms`, cursor: 'default' }}
                >
                  <Card
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      height: '100%',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {/* Top half — pitch photo placeholder */}
                    <div style={{ position: 'relative', height: '180px', background: '#111111' }}>
                      <div
                        style={{
                          position: 'absolute', top: '10px', left: '10px',
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: 'var(--radius-full)',
                          background: card.players >= 8 ? 'var(--green)' : 'rgba(0,0,0,0.6)',
                          color: card.players >= 8 ? 'var(--black)' : '#fff',
                          fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        <PeopleIcon /> {card.players}/10 players
                      </div>
                      {/* EXAMPLE watermark — centred, honest labelling */}
                      <div aria-hidden style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700,
                        letterSpacing: '0.25em', textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.08)',
                      }}>
                        Example
                      </div>
                    </div>

                    {/* Bottom half — game details */}
                    <div style={{ background: '#0e0e0e', padding: '1rem 1.2rem' }}>
                      <div style={{
                        fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                        letterSpacing: '-0.01em', color: '#fff', lineHeight: 1.2, marginBottom: '6px',
                      }}>
                        Example game
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontFamily: 'var(--font-sans)', fontSize: '12px',
                        color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px',
                      }}>
                        <ClockIcon /> {exampleDates[i]} · {card.time}
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontFamily: 'var(--font-sans)', fontSize: '12px',
                        color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.9rem',
                      }}>
                        <PinIcon /> Globe Football Pitch · Bethnal Green
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <Badge variant={card.badge}>{typeLabelFromVariant(card.badge)}</Badge>
                        <div style={{
                          display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                          padding: '5px 12px', borderRadius: 'var(--radius-full)',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>
                            {card.price}
                          </span>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--green)', opacity: 0.85 }}>
                            per player
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        </section>

        {/* ============================================================
            HOW IT WORKS
            ============================================================ */}
        <section style={{ paddingTop: 'clamp(4rem, 8vh, 6rem)', paddingBottom: 'clamp(4rem, 8vh, 6rem)' }}>
          <Container>
            {/* Section header */}
            <div className="reveal-scroll" style={{ marginBottom: '3rem' }}>
              <SectionHeading
                eyebrow="How it works"
                heading={
                  <>
                    Four steps<br />
                    <span style={{ color: 'var(--green)' }}>to kickoff.</span>
                  </>
                }
              />
            </div>

            {/* Step cards */}
            <div className="steps-grid-new">
              {[
                { n: '01', t: 'Find an open game time', d: 'Browse available times at Globe Pitch and pick one that works for you.' },
                { n: '02', t: 'Share the link', d: 'You get a unique link for your game. Drop it in the group chat in seconds.' },
                { n: '03', t: 'Mates join', d: "Friends click the link and add their card. Nobody is charged yet. Zero commitment." },
                { n: '04', t: '10 players = booked', d: 'The moment the 10th player joins, everyone pays their share. Pitch confirmed.' },
              ].map((step, idx) => {
                const isPayoff = step.n === '04'
                return (
                  <Card
                    key={step.n}
                    hover
                    className={`reveal-scroll${step.n !== '04' ? ' step-connector-arrow' : ''}${isPayoff ? ' step-card-payoff' : ''}`}
                    style={{
                      padding: '1.75rem 1.5rem 1.6rem',
                      position: 'relative',
                      animationDelay: `${idx * 60}ms`,
                      ...(isPayoff ? {
                        background: 'rgba(22,48,31,0.40)',
                        border: '1px solid rgba(198,241,53,0.28)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(198,241,53,0.14), 0 0 28px -6px rgba(198,241,53,0.20)',
                      } : {}),
                    }}
                  >
                    {/* Outline stroke numeral — intentional graphic element */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        bottom: '0.5rem',
                        right: '0.75rem',
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(3.5rem, 5.5vw, 5rem)',
                        fontWeight: 700,
                        lineHeight: 1,
                        letterSpacing: '-0.04em',
                        color: 'transparent',
                        WebkitTextStroke: '1.5px rgba(198,241,53,0.20)',
                        userSelect: 'none',
                        pointerEvents: 'none',
                      }}
                    >
                      {step.n}
                    </div>

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.65rem' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: 'var(--green)',
                            flexShrink: 0,
                            opacity: isPayoff ? 1 : 0.7,
                          }}
                        />
                        <h3
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(14px, 1.8vw, 16px)',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            lineHeight: 1.2,
                            color: 'var(--text)',
                            margin: 0,
                          }}
                        >
                          {isPayoff ? (
                            <>10 players = <span style={{ color: 'var(--green)' }}>booked</span></>
                          ) : step.t}
                        </h3>
                      </div>
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.7,
                          fontWeight: 400,
                          margin: 0,
                        }}
                      >
                        {step.d}
                      </p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </Container>
        </section>

        {/* ============================================================
            FAQ
            ============================================================ */}
        <FaqAccordion />

        {/* ============================================================
            PITCH OWNER — pitch-green tinted band
            ============================================================ */}
        <section
          style={{
            background: 'rgba(22,48,31,0.35)',
            borderTop: '1px solid rgba(198,241,53,0.12)',
            borderBottom: '1px solid rgba(198,241,53,0.12)',
            padding: '6rem 2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative concentric rings */}
          {[640, 440, 260].map((size, i) => (
            <div
              key={size}
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${size}px`,
                height: `${size}px`,
                border: `1px solid rgba(198,241,53,${0.06 + i * 0.03})`,
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />
          ))}

          <div className="reveal-scroll" style={{ maxWidth: '560px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)',
                marginBottom: '1.25rem',
              }}
            >
              For pitch owners
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(32px, 4vw, 56px)',
                letterSpacing: '-0.04em',
                lineHeight: 0.92,
                marginBottom: '1.5rem',
                color: 'var(--text)',
              }}
            >
              Want to list your pitch?
            </h2>
            <p
              style={{
                fontSize: '17px',
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                fontWeight: 500,
                marginBottom: '2.5rem',
              }}
            >
              We handle bookings, payments and player coordination automatically. No more WhatsApp messages, no more chasing bank transfers. Money lands in your account the moment a game confirms.
            </p>
            <a href="mailto:masud.bookmypitch@gmail.com" style={{ textDecoration: 'none' }}>
              <button
                className="btn-g"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  padding: '1rem 2.5rem',
                  borderRadius: 'var(--radius-lg)',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--green)',
                  color: 'var(--black)',
                  transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                  lineHeight: 1,
                }}
              >
                Get in touch →
              </button>
            </a>
          </div>
        </section>

        {/* ============================================================
            FOOTER
            ============================================================ */}
        <footer
          style={{
            borderTop: '1px solid var(--border)',
            padding: '2.5rem 2rem',
          }}
        >
          <div
            style={{
              maxWidth: '1140px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  marginRight: '12px',
                  lineHeight: 1,
                }}
              >
                Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
                <span style={{ color: 'var(--green)', fontSize: '10px', verticalAlign: 'super', marginLeft: '1px', opacity: 0.75, fontWeight: 600 }}>.uk</span>
              </span>
              Globe Football Pitch · 110 Globe Rd, Bethnal Green E1 4DZ
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              © 2025 BookMyPitch.uk
            </div>
          </div>
        </footer>

      </main>
    </PageReveal>
  )
}
