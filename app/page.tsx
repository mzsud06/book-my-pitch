import Link from 'next/link'
import Nav from '@/components/Nav'
import PageReveal from '@/components/PageReveal'
import { createServiceClient } from '@/lib/supabase/service'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'

// ─── Image swap — edit these two spots when photos are ready ─────────
//
//  HERO BACKGROUND
//  Line 14 below. Set to a path, e.g. '/images/hero.jpg', to replace
//  the gradient glow with a full-bleed photo + dark overlay.
const HERO_IMAGE: string | null = null

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
    rival: true,
    urgency: '⚡ Another group racing for this',
  },
  {
    image: null as string | null,   // swap → '/images/offpeak.jpg'
    badge: 'offpeak' as const,
    badgeLabel: 'Off-peak · Mon–Fri',
    time: '16:30 – 17:30',
    price: '£3.00',
    players: 4,
    rival: false,
    urgency: null,
  },
  {
    image: null as string | null,   // swap → '/images/weekend.jpg'
    badge: 'neutral' as const,
    badgeLabel: 'Weekend',
    time: '09:30 – 10:30',
    price: '£4.00',
    players: 2,
    rival: false,
    urgency: null,
  },
]
// ─────────────────────────────────────────────────────────────────────

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
  // ── Fetch real open games (future dates only) ──────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawGames } = await createServiceClient()
    .from('sessions')
    .select('id, organiser_name, slots!inner(date, start_time, end_time, type, price), players(count)')
    .eq('game_type', 'open')
    .eq('status', 'filling')
    .eq('is_public', true)
    .gte('slots.date', today)
    .limit(10)

  type LiveGameRow = {
    id: string
    organiser_name: string | null
    slots: { date: string; start_time: string; end_time: string; type: string; price: number }
    players: { count: number }[]
  }

  const liveGames = ((rawGames as unknown as LiveGameRow[]) ?? [])
    .map(s => {
      const slot = Array.isArray(s.slots) ? s.slots[0] : s.slots
      const playerCount = (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
      const type = slot.type as 'peak' | 'offpeak' | 'weekend'
      return {
        id: s.id,
        time: `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`,
        price: `£${(slot.price / 10).toFixed(2)}`,
        playerCount,
        type,
        badgeVariant: (type === 'peak' ? 'peak' : type === 'weekend' ? 'neutral' : 'offpeak') as 'peak' | 'offpeak' | 'neutral',
        badgeLabel: type === 'peak' ? 'Peak · Every day' : type === 'offpeak' ? 'Off-peak · Mon–Fri' : 'Weekend',
      }
    })
    .sort((a, b) => b.playerCount - a.playerCount)
    .slice(0, 3)

  const exampleCards = PREVIEW_CARDS.slice(0, Math.max(0, 3 - liveGames.length))
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
          {HERO_IMAGE ? (
            /* When HERO_IMAGE is set: photo + dark overlay */
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <img
                src={HERO_IMAGE}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(8,8,8,0.90) 0%, rgba(8,8,8,0.55) 45%, rgba(8,8,8,0.25) 100%)',
              }} />
            </div>
          ) : (
            /* Fallback: moody off-centre acid-green glow into pitch-green into black */
            <div aria-hidden style={{
              position: 'absolute', inset: 0, zIndex: 0,
              background: [
                'radial-gradient(ellipse 110% 70% at 50% 140%, rgba(22,48,31,0.75) 0%, transparent 55%)',
                'radial-gradient(ellipse 60% 45% at 50% 130%, rgba(198,241,53,0.065) 0%, transparent 50%)',
              ].join(', '),
            }} />
          )}

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

                {/* Headline — two lines, existing copy verbatim */}
                <h1
                  className="anim-fade-up d-80"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-hero)',
                    lineHeight: 0.95,
                    letterSpacing: '-0.015em',
                    fontWeight: 700,
                    margin: '0 0 0.06em',
                    color: 'var(--text)',
                  }}
                >
                  Fill the team.
                </h1>
                <h1
                  className="anim-fade-up d-150"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-hero)',
                    lineHeight: 0.95,
                    letterSpacing: '-0.015em',
                    fontWeight: 700,
                    margin: '0 0 1.75rem',
                    color: 'var(--green)',
                  }}
                >
                  Book the pitch.
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
                  Share a link with your mates. Once 10 players join, everyone pays their share. The pitch is yours.
                </p>

                {/* Primary CTA */}
                <div className="anim-fade-up d-300" style={{ marginBottom: '3.5rem' }}>
                  <Link href="/slots" style={{ textDecoration: 'none' }}>
                    <Button size="lg" arrow>Find a slot</Button>
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
          <div className="preview-cards-scroller">
            {/* ── Real open games ── */}
            {liveGames.map((game, idx) => (
              <Link
                key={game.id}
                href={`/session/${game.id}`}
                className="preview-card-link anim-fade-up"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <Card hover style={{ overflow: 'hidden', height: '100%' }}>
                  <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: idx === 0
                        ? 'linear-gradient(145deg, #1a3322 0%, #0f1f14 55%, #080808 100%)'
                        : idx === 1
                        ? 'linear-gradient(145deg, #142519 0%, #0c1a10 55%, #080808 100%)'
                        : 'linear-gradient(145deg, #111a12 0%, #0a1309 55%, #080808 100%)',
                    }}>
                      <div aria-hidden style={{
                        position: 'absolute', inset: 0,
                        background: 'radial-gradient(ellipse 70% 55% at 50% 100%, rgba(198,241,53,0.05) 0%, transparent 60%)',
                      }} />
                    </div>
                    <div aria-hidden style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(8,8,8,0.80) 0%, rgba(8,8,8,0.2) 50%, transparent 100%)',
                    }} />
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <Badge variant={game.badgeVariant}>{game.badgeLabel}</Badge>
                    </div>
                    <div style={{ position: 'absolute', bottom: '12px', left: '14px' }}>
                      <div className="tabular" style={{
                        fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700,
                        color: 'var(--green)', lineHeight: 1, letterSpacing: '-0.01em',
                        textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                      }}>
                        {game.price}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-sans)', fontSize: '10px',
                        color: 'rgba(155,163,154,0.85)', marginTop: '2px',
                        fontWeight: 500, letterSpacing: '0.04em',
                      }}>
                        per player
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '1.2rem 1.35rem 1.3rem' }}>
                    <div className="tabular" style={{
                      fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                      letterSpacing: '-0.01em', color: 'var(--text)', lineHeight: 1, marginBottom: '0.85rem',
                    }}>
                      {game.time}
                    </div>
                    <div style={{
                      height: '3px', borderRadius: '99px',
                      background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '0.55rem',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(game.playerCount / 10) * 100}%`,
                        borderRadius: '99px',
                        background: game.badgeVariant === 'peak'
                          ? 'linear-gradient(90deg, var(--amber), rgba(255,184,0,0.7))'
                          : 'var(--green)',
                        boxShadow: game.badgeVariant === 'peak'
                          ? '0 0 6px rgba(255,184,0,0.4)'
                          : '0 0 6px rgba(198,241,53,0.35)',
                        transition: 'width 0.6s var(--ease-out)',
                      }} />
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-sans)', fontSize: '11px',
                      color: 'var(--text-secondary)', fontWeight: 500,
                    }}>
                      {game.playerCount}/10 joined · {10 - game.playerCount} spots left
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
                  <Card style={{ overflow: 'hidden', height: '100%' }}>
                    <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                      {card.image ? (
                        <img
                          src={card.image}
                          alt=""
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: idx === 0
                            ? 'linear-gradient(145deg, #1a3322 0%, #0f1f14 55%, #080808 100%)'
                            : idx === 1
                            ? 'linear-gradient(145deg, #142519 0%, #0c1a10 55%, #080808 100%)'
                            : 'linear-gradient(145deg, #111a12 0%, #0a1309 55%, #080808 100%)',
                        }}>
                          <div aria-hidden style={{
                            position: 'absolute', inset: 0,
                            background: 'radial-gradient(ellipse 70% 55% at 50% 100%, rgba(198,241,53,0.05) 0%, transparent 60%)',
                          }} />
                        </div>
                      )}
                      <div aria-hidden style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(8,8,8,0.80) 0%, rgba(8,8,8,0.2) 50%, transparent 100%)',
                      }} />
                      <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                        <Badge variant={card.badge}>{card.badgeLabel}</Badge>
                      </div>
                      {/* EXAMPLE label — top right, muted, honest labelling */}
                      <div style={{
                        position: 'absolute', top: '12px', right: '12px',
                        fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'rgba(155,163,154,0.5)',
                      }}>
                        Example
                      </div>
                      <div style={{ position: 'absolute', bottom: '12px', left: '14px' }}>
                        <div className="tabular" style={{
                          fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700,
                          color: 'var(--green)', lineHeight: 1, letterSpacing: '-0.01em',
                          textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                        }}>
                          {card.price}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-sans)', fontSize: '10px',
                          color: 'rgba(155,163,154,0.85)', marginTop: '2px',
                          fontWeight: 500, letterSpacing: '0.04em',
                        }}>
                          per player
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '1.2rem 1.35rem 1.3rem' }}>
                      <div className="tabular" style={{
                        fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                        letterSpacing: '-0.01em', color: 'var(--text)', lineHeight: 1, marginBottom: '0.85rem',
                      }}>
                        {card.time}
                      </div>
                      <div style={{
                        height: '3px', borderRadius: '99px',
                        background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '0.55rem',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(card.players / 10) * 100}%`,
                          borderRadius: '99px',
                          background: card.badge === 'peak'
                            ? 'linear-gradient(90deg, var(--amber), rgba(255,184,0,0.7))'
                            : 'var(--green)',
                          boxShadow: card.badge === 'peak'
                            ? '0 0 6px rgba(255,184,0,0.4)'
                            : '0 0 6px rgba(198,241,53,0.35)',
                          transition: 'width 0.6s var(--ease-out)',
                        }} />
                      </div>
                      {card.rival ? (
                        <div style={{
                          fontFamily: 'var(--font-sans)', fontSize: '11px',
                          color: 'var(--amber)', fontWeight: 700, letterSpacing: '0.01em',
                        }}>
                          {card.urgency}
                        </div>
                      ) : (
                        <div style={{
                          fontFamily: 'var(--font-sans)', fontSize: '11px',
                          color: 'var(--text-secondary)', fontWeight: 500,
                        }}>
                          {card.players}/10 joined · {10 - card.players} spots left
                        </div>
                      )}
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
            <div
              className="reveal-scroll"
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: '3rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <SectionHeading
                eyebrow="How it works"
                heading={
                  <>
                    Four steps<br />
                    <span style={{ color: 'var(--green)' }}>to kickoff.</span>
                  </>
                }
              />
              <Link href="/slots" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <Button variant="ghost" size="md" arrow>Browse slots</Button>
              </Link>
            </div>

            {/* Step cards */}
            <div className="steps-grid-new">
              {[
                { n: '01', t: 'Find an open slot', d: 'Browse available times at Globe Pitch and pick one that works for you.' },
                { n: '02', t: 'Share the link', d: 'You get a unique link for your session. Drop it in the group chat in seconds.' },
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
                letterSpacing: '0.18em',
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
