import Link from 'next/link'
import Image from 'next/image'
import Nav from '@/components/Nav'
import PageReveal from '@/components/PageReveal'
import { createServiceClient } from '@/lib/supabase/service'
import { getSlotType, scheduleFromVenue, VenueSchedule } from '@/lib/slots'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FaqAccordion } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'
import { GameCard } from '@/components/GameCard'
import MoneyHeldDemo from '@/components/MoneyHeldDemo'
import { SquadStrip, ConfirmedStamp, LockIcon } from '@/components/SquadStrip'

export const revalidate = 0

// Hardcoded stand-ins shown when there are fewer than 3 real public games.
// Not real sessions: no id, not clickable, always 0/10 players.
const PLACEHOLDER_CARDS = [
  { badge: 'peak' as const, time: '18:30 – 19:30', price: '£5.00', dayOfWeek: 1 },
  { badge: 'offpeak' as const, time: '16:30 – 17:30', price: '£3.00', dayOfWeek: 3 },
  { badge: 'weekend' as const, time: '10:30 – 11:30', price: '£4.00', dayOfWeek: 6 },
]

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

function nextWeekdayDate(dayOfWeek: number): string {
  const d = new Date()
  const diff = ((dayOfWeek - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function typeLabelFromVariant(variant: 'peak' | 'offpeak' | 'weekend'): string {
  return variant === 'peak' ? 'Peak' : variant === 'offpeak' ? 'Off-peak' : 'Weekend'
}

export default async function HomePage() {
  // ── Fetch real public games (future dates only) ──────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawGames } = await createServiceClient()
    .from('sessions')
    .select('id, organiser_name, status, slots!inner(date, start_time, end_time, price, pitches(max_players), venues(name, address, opening_time, closing_time, weekend_opening_time, weekend_closing_time, peak_start_time, daily_hours)), players(count)')
    .eq('game_type', 'open')
    .in('status', ['filling', 'confirmed'])
    .eq('is_public', true)
    .gte('slots.date', today)

  type GameVenue = Partial<VenueSchedule> & { name: string; address: string }
  type LiveGameRow = {
    id: string
    organiser_name: string | null
    status: string
    slots: {
      date: string; start_time: string; end_time: string; price: number
      pitches: { max_players: number }
      venues: GameVenue | GameVenue[] | null
    }
    players: { count: number }[]
  }

  const allPublicGames = ((rawGames as unknown as LiveGameRow[]) ?? [])
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
        badgeLabel: type === 'peak' ? 'Peak · Every day' : type === 'offpeak' ? 'Off-peak · Mon–Fri' : 'Weekend',
      }
    })
    .sort((a, b) => Number(a.isFull) - Number(b.isFull) || b.playerCount - a.playerCount)

  const liveGames = allPublicGames.slice(0, 3)

  const exampleCards = PLACEHOLDER_CARDS.slice(0, Math.max(0, 3 - liveGames.length)).map(card => ({
    ...card,
    date: fmtSlotDate(nextWeekdayDate(card.dayOfWeek)),
  }))
  // ──────────────────────────────────────────────────────────────────────


  return (
    <PageReveal>
      <Nav />
      <main style={{ position: 'relative', zIndex: 1 }}>

        {/* ============================================================
            HERO
            ============================================================ */}
        <section style={{ paddingTop: 'clamp(2.5rem, 7vh, 4.5rem)', paddingBottom: 'clamp(2.5rem, 6vh, 4rem)' }}>
          <Container>
            <div className="hero-split hero-split-2">
              <div>
                <div className="anim-fade-up d-0" style={{ marginBottom: '1.25rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--text)',
                  }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)' }} />
                    5-a-side &amp; 7-a-side · East London
                  </span>
                </div>

                <h1
                  className="anim-fade-up d-80"
                  style={{
                    fontFamily: 'var(--font-display)', fontStretch: '75%',
                    fontSize: 'var(--text-hero)', lineHeight: 0.92, letterSpacing: '-0.01em',
                    fontWeight: 900, textTransform: 'uppercase', margin: '0 0 1.25rem', color: 'var(--text)',
                  }}
                >
                  Pay only if<br />the game&apos;s <span style={{ color: 'var(--brand)' }}>on.</span>
                </h1>

                <p
                  className="anim-fade-up d-200"
                  style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '46ch', margin: '0 0 1.75rem', fontWeight: 500 }}
                >
                  Join a game with your card. It&apos;s held, not taken. Once the squad is full, everyone is charged and the pitch is yours. If it doesn&apos;t fill, nobody pays and nobody chases anyone.
                </p>

                <div className="anim-fade-up d-300" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href="/slots" style={{ textDecoration: 'none' }}>
                    <Button size="lg" arrow>Find a game</Button>
                  </Link>
                  <Link href="/list-your-venue" style={{ textDecoration: 'none' }}>
                    <Button size="lg" variant="secondary">I run a pitch</Button>
                  </Link>
                </div>
              </div>

              {/* Photo with a live-looking squad strip pinned on it */}
              <div className="anim-fade-up d-200 hero-photo-wrap">
                <Image
                  src="/hero-pitch.jpg"
                  alt="A 5-a-side pitch under floodlights"
                  fill
                  priority
                  quality={85}
                  sizes="(max-width: 900px) 100vw, 520px"
                  style={{ objectFit: 'cover', objectPosition: 'center 35%' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,20,24,0.45), rgba(16,20,24,0) 55%)' }} />
                <div style={{
                  position: 'absolute', left: 14, right: 14, bottom: 14,
                  background: 'var(--surface)', borderRadius: 16, padding: '12px 14px 12px',
                  boxShadow: '0 10px 30px rgba(16,20,24,0.25)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 17 }}>Tonight · 5-a-side</span>
                    <span className="tabular" style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 17 }}>£6 <span style={{ fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>EACH</span></span>
                  </div>
                  <SquadStrip filled={7} total={10} size="sm" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><LockIcon size={12} /></span>
                    7/10 · £42 held · 3 spots left
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ============================================================
            MONEY HELD, NOT TAKEN
            ============================================================ */}
        <section style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 'clamp(3rem, 7vh, 5rem) 0' }}>
          <Container>
            <div className="reveal-scroll" style={{ marginBottom: '2rem', maxWidth: 680 }}>
              <SectionHeading
                eyebrow="How the money works"
                heading={<>Held, not taken.<br /><span style={{ color: 'var(--brand)' }}>Charged when it&apos;s full.</span></>}
                sub="Everyone pays when they join, so there are no promises to chase. Full squad: everyone is charged at once. Not full: every hold is released."
              />
            </div>
            <MoneyHeldDemo />
          </Container>
        </section>

        {/* ============================================================
            GAMES FILLING NOW
            ============================================================ */}
        <section style={{ paddingTop: 'clamp(3rem, 7vh, 5rem)', paddingBottom: 'clamp(2.5rem, 5vh, 3.5rem)' }}>
          <Container>
            <div className="reveal-scroll" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <SectionHeading eyebrow="Open games" heading="Squads filling now" />
              <Link href="/public-games" style={{ textDecoration: 'none', fontWeight: 700, fontSize: 15, color: 'var(--text)', borderBottom: '2px solid var(--brand)', paddingBottom: 2 }}>
                See all games →
              </Link>
            </div>
          </Container>
          <div className="preview-cards-scroller">
            {liveGames.map((game, idx) => (
              <div key={game.id} className="preview-card-link anim-fade-up" style={{ animationDelay: `${idx * 80}ms` }}>
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
                  priority={idx === 0}
                />
              </div>
            ))}

            {/* Example cards fill the row to 3 until there are enough real games */}
            {exampleCards.map((card, i) => {
              const idx = liveGames.length + i
              return (
                <div key={card.time} className="preview-card-link anim-fade-up" style={{ animationDelay: `${idx * 80}ms` }}>
                  <GameCard
                    photo="/game-card.jpg"
                    title={`${typeLabelFromVariant(card.badge)} game`}
                    venue="Your local pitch"
                    date={card.date}
                    time={card.time.split(' – ')[0]}
                    price={card.price}
                    filled={0}
                    total={10}
                    format="5-a-side"
                    badge={<Badge variant={card.badge}>{typeLabelFromVariant(card.badge)}</Badge>}
                  />
                </div>
              )
            })}
          </div>
        </section>

        {/* ============================================================
            HOW IT WORKS
            ============================================================ */}
        <section style={{ paddingTop: 'clamp(2.5rem, 6vh, 4rem)', paddingBottom: 'clamp(3rem, 7vh, 5rem)' }}>
          <Container>
            <div className="reveal-scroll" style={{ marginBottom: '2rem' }}>
              <SectionHeading eyebrow="Start your own" heading="Four steps to kickoff" />
            </div>
            <div className="steps-grid-new">
              {[
                { n: '1', t: 'Pick a time', d: 'Browse open times at your local pitch and choose one that works.' },
                { n: '2', t: 'Share the link', d: 'You get one link for your game. Drop it in the group chat.' },
                { n: '3', t: 'Mates join', d: 'Each player adds a card. Nothing is charged yet, so there is no commitment.' },
                { n: '4', t: 'Squad full, pitch booked', d: 'The moment the last spot goes, everyone pays their share and the game is confirmed.' },
              ].map((step, idx) => (
                <div key={step.n} className="reveal-scroll step-tile" style={{ animationDelay: `${idx * 60}ms` }}>
                  <div className={`step-num${step.n === '4' ? ' is-volt' : ''}`} aria-hidden="true">{step.n}</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontSize: 22, fontWeight: 800, lineHeight: 1.1, margin: '0 0 6px', color: 'var(--text)' }}>
                    {step.t}
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>{step.d}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ============================================================
            FOR VENUES BAND
            ============================================================ */}
        <section style={{ background: 'var(--ink)', color: '#fff', padding: 'clamp(3rem, 7vh, 5rem) 0' }}>
          <Container>
            <div className="venue-band">
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--volt)' }} /> For pitch owners
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontSize: 'var(--text-h2)', fontWeight: 900, lineHeight: 0.98, textTransform: 'uppercase', color: '#fff', margin: '0.75rem 0 1rem' }}>
                  Full payment before kick-off.<br />
                  <span style={{ color: 'var(--volt)' }}>No chasing.</span>
                </h2>
                <p style={{ fontSize: 17, lineHeight: 1.55, color: 'rgba(255,255,255,0.8)', maxWidth: '44ch', margin: '0 0 1.5rem', fontWeight: 500 }}>
                  No more WhatsApp threads, cash on the night or empty slots from people who flaked. Every booking is paid in full by the time it confirms.
                </p>
                <Link href="/list-your-venue" style={{ textDecoration: 'none' }}>
                  <Button size="lg" arrow>See how it works for venues</Button>
                </Link>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 18, color: '#fff' }}>Thu 19:00 · 5-a-side</span>
                  <ConfirmedStamp />
                </div>
                <SquadStrip filled={10} total={10} status="confirmed" size="md" />
                <div className="tabular" style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 34, color: 'var(--volt)', marginTop: 14, lineHeight: 1 }}>
                  £60 secured
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 4 }}>Paid before anyone touched a ball.</div>
              </div>
            </div>
          </Container>
        </section>

        {/* ============================================================
            TESTIMONIALS
            ============================================================ */}
        <section style={{ paddingTop: 'clamp(3rem, 7vh, 5rem)', paddingBottom: 'clamp(3rem, 7vh, 5rem)' }}>
          <Container>
            <div className="reveal-scroll" style={{ marginBottom: '2rem' }}>
              <SectionHeading eyebrow="From the pitch" heading="What players are saying" />
            </div>

            <div className="testimonials-grid">
              {[
                { quote: "Finally sorted our Wednesday games without the WhatsApp chaos. Everyone just clicks the link and it's done.", name: 'Tariq', location: 'Bethnal Green' },
                { quote: "Joined a public game last week with people I didn't know. Worked perfectly, good bunch.", name: 'Raheem', location: 'Tower Hamlets' },
                { quote: "Our group's been using it for three weeks. No complaints.", name: 'Liam', location: 'Mile End' },
              ].map((t, idx) => (
                <Card key={t.name} className="reveal-scroll" style={{ padding: '1.5rem', animationDelay: `${idx * 60}ms`, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.6, fontWeight: 500, margin: '0 0 1.25rem', flex: 1 }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span aria-hidden="true" style={{
                      width: 36, height: 36, borderRadius: 8, background: 'var(--ink)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 18, flexShrink: 0,
                    }}>
                      {t.name[0]}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{t.location}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        <FaqAccordion />
        <Footer />
      </main>
    </PageReveal>
  )
}
