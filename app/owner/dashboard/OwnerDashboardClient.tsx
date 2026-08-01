'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSlotType, isSlotInPast, scheduleFromVenue } from '@/lib/slots'
import { Card } from '@/components/ui/Card'

interface Venue {
  id: string
  name: string
  address: string
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  admin_approved: boolean
  opening_time?: string
  closing_time?: string
  weekend_opening_time?: string
  weekend_closing_time?: string
  peak_start_time?: string
}

interface SessionData {
  id: string
  status: string
  created_at: string
  organiser_name?: string | null
  slots: {
    date: string
    start_time: string
    end_time: string
    type: string
    price: number
    max_players: number
  }
  players: { id: string; name: string; joined_at: string }[]
  bookings: { id: string; confirmed_at: string }[]
}

interface Stats {
  confirmedThisWeek: number
  revenueThisWeek: number
  totalRevenue: number
  fillRate: number
}

interface OccupancyEntry {
  time: string
  type: string
  confirmed: number
  total: number
}

interface Props {
  venue: Venue
  sessions: SessionData[]
  stats: Stats
  occupancyData: OccupancyEntry[]
  weekDays: number
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function totalPlayers(s: SessionData): number {
  const organiserCount = s.organiser_name ? 1 : 0
  return organiserCount + s.players.length
}

const typeLabels: Record<string, string> = {
  offpeak: 'Off-peak',
  peak: 'Peak',
  weekend: 'Weekend',
}

// Matches components/ui/Badge's canonical peak/weekend colors — these were
// previously invented independently and had drifted from the actual badge
// colors shown everywhere else in the app.
const typeColors: Record<string, string> = {
  offpeak: 'var(--green)',
  peak: 'var(--amber)',
  weekend: '#5EA8FF',
}

export default function OwnerDashboardClient({ venue, sessions: initialSessions, stats, occupancyData }: Props) {
  const [sessions, setSessions] = useState(initialSessions)
  const schedule = scheduleFromVenue(venue)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboardingError, setOnboardingError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleFinishOnboarding() {
    setOnboardingLoading(true)
    setOnboardingError('')
    try {
      const res = await fetch('/api/owner/stripe-onboarding-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: venue.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setOnboardingError(data.error ?? 'Failed to start Stripe onboarding')
        setOnboardingLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setOnboardingError('Failed to start Stripe onboarding')
      setOnboardingLoading(false)
    }
  }

  useEffect(() => {
    function fetchSessions() {
      supabase
        .from('sessions')
        .select(`
          id, status, created_at, organiser_name,
          slots!inner(date, start_time, end_time, price, venue_id, pitches(max_players)),
          players(id, name, joined_at),
          bookings(id, confirmed_at)
        `)
        .eq('slots.venue_id', venue.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          if (!data) return
          const withType = (data as unknown as { slots: { date: string; start_time: string; pitches: { max_players: number } } | { date: string; start_time: string; pitches: { max_players: number } }[] }[]).map(s => {
            const raw = Array.isArray(s.slots) ? s.slots[0] : s.slots
            return {
              ...s,
              slots: { ...raw, type: getSlotType(raw.date, raw.start_time, schedule), max_players: raw.pitches.max_players },
            }
          })
          setSessions(withType as unknown as SessionData[])
        })
    }

    const channel = supabase
      .channel('owner-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchSessions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchSessions)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [venue.id])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/owner/login')
  }

  const confirmed = sessions.filter(s => s.status === 'confirmed')
  // Cosmetic-only filter: a 'filling' session whose slot has already started
  // is stale even though its DB row hasn't flipped yet (the browser client
  // can't perform that write — no service-role access). The realtime
  // subscription refetches often enough that this just hides it from "Currently
  // filling" until the next full page load actually sweeps it server-side.
  const filling = sessions.filter(s => s.status === 'filling' && !isSlotInPast(s.slots.date, s.slots.start_time))

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--black)',
        color: 'var(--text)',
      }}
    >
      {/* Dashboard Nav */}
      <div
        className="owner-dash-nav"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          rowGap: '8px',
          borderBottom: '1px solid var(--border)',
          borderTop: '3px solid var(--green)',
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(28px)',
          position: 'sticky',
          top: 0,
          zIndex: 200,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '17px',
                letterSpacing: '-0.04em',
                color: 'var(--text)',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
              <span style={{ color: 'var(--green)', fontSize: '12px', verticalAlign: 'super', marginLeft: '1px' }}>.uk</span>
            </span>
          </Link>
          <span
            className="owner-dash-nav-divider"
            style={{
              width: '1px',
              height: '16px',
              background: 'var(--border)',
              display: 'block',
            }}
          />
          <span
            className="owner-dash-nav-label"
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Owner dashboard
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {!venue.stripe_onboarding_complete ? (
            <button
              onClick={handleFinishOnboarding}
              disabled={onboardingLoading}
              style={{
                background: 'rgba(255,68,68,0.08)',
                border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '12px',
                color: 'var(--red)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: onboardingLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                opacity: onboardingLoading ? 0.6 : 1,
              }}
            >
              <span>⚠</span>
              {onboardingLoading
                ? 'Starting…'
                : venue.stripe_account_id
                  ? 'Finish payouts setup'
                  : 'Set up payouts'}
            </button>
          ) : !venue.admin_approved ? (
            // Payouts are verified, but a human hasn't vetted the venue itself
            // yet — nothing to click here, just set expectations.
            <div
              style={{
                background: 'rgba(255,184,0,0.08)',
                border: '1px solid rgba(255,184,0,0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '12px',
                color: 'var(--amber)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⏳</span> Awaiting approval
            </div>
          ) : null}
          <button
            onClick={handleSignOut}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, color 0.15s ease',
              lineHeight: 1,
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {onboardingError && (
        <div
          style={{
            background: 'rgba(255,68,68,0.08)',
            borderBottom: '1px solid rgba(255,68,68,0.2)',
            padding: '0.6rem 2rem',
            fontSize: '13px',
            color: 'var(--red)',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {onboardingError}
        </div>
      )}

      <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '2.5rem clamp(1rem, 4vw, 2rem) 4rem' }}>

        {/* Venue header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            className="anim-fade-up"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(24px, 4vw, 34px)',
              letterSpacing: '-0.04em',
              lineHeight: 0.95,
              marginBottom: '0.4rem',
            }}
          >
            {venue.name}
          </div>
          <div className="anim-fade-up d-80" style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {venue.address}
          </div>
        </div>

        {/* Stats grid */}
        <div
          className="stats-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.75rem' }}
        >
          {[
            { n: String(stats.confirmedThisWeek), l: 'Confirmed this week', accent: true },
            { n: `£${stats.revenueThisWeek}`, l: 'Revenue this week', accent: true },
            { n: `£${stats.totalRevenue.toLocaleString()}`, l: 'Total revenue', accent: false },
            { n: `${stats.fillRate}%`, l: 'Fill rate', accent: false },
          ].map((stat, idx) => (
            <Card
              key={stat.l}
              className="dash-stat-card anim-fade-up"
              style={{ padding: '1.3rem 1.4rem', animationDelay: `${idx * 55}ms` }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 3vw, 32px)',
                  color: 'var(--green)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  marginBottom: '6px',
                }}
              >
                {stat.n}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.02em' }}>
                {stat.l}
              </div>
            </Card>
          ))}
        </div>

        <div className="dash-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

          {/* Confirmed bookings */}
          <Card style={{ padding: '1.4rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.1rem',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  letterSpacing: '-0.025em',
                }}
              >
                Confirmed bookings
              </div>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--green)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span className="green-dot" style={{ width: '6px', height: '6px' }} />
                All paid ✓
              </span>
            </div>

            {confirmed.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '1rem 0', fontWeight: 500 }}>
                No confirmed bookings yet
              </div>
            )}

            {confirmed.slice(0, 8).map((s, idx) => (
              <Link key={s.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="dash-session-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.7rem 0.6rem',
                    borderBottom: idx < Math.min(confirmed.length, 8) - 1 ? '1px solid var(--border)' : 'none',
                    borderRadius: '8px',
                    margin: '0 -0.6rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '2px' }}>
                      {s.slots.start_time.slice(0, 5)}
                      {' '}
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: typeColors[s.slots.type] ?? 'var(--text-secondary)',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {typeLabels[s.slots.type] ?? s.slots.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {formatDate(s.slots.date)} · {totalPlayers(s)} players
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--green)', letterSpacing: '-0.02em' }}>
                      £{s.slots.price}.00
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>Paid ✓</div>
                  </div>
                </div>
              </Link>
            ))}
          </Card>

          {/* Slot occupancy */}
          <Card style={{ padding: '1.4rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.1rem',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  letterSpacing: '-0.025em',
                }}
              >
                Slot occupancy
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>This week</span>
            </div>

            {occupancyData.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '1rem 0', fontWeight: 500 }}>
                No data for this week
              </div>
            )}

            {occupancyData.map((occ, idx) => {
              const fillPct = occ.total > 0 ? (occ.confirmed / occ.total) * 100 : 0
              return (
                <div
                  key={occ.time}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '0.6rem 0',
                    borderBottom: idx < occupancyData.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ minWidth: '96px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        color: typeColors[occ.type] ?? 'var(--text)',
                      }}
                    >
                      {occ.time.slice(0, 5)}
                      {' '}
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {typeLabels[occ.type] ?? ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '1px' }}>
                      {occ.type === 'weekend' ? 'Weekend' : 'Mon–Fri'}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: '6px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '100px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: '100px',
                        background: fillPct >= 80 ? 'var(--green)' : fillPct >= 50 ? 'var(--amber)' : 'var(--muted)',
                        width: `${fillPct}%`,
                        transition: 'width 0.8s var(--ease-out)',
                        boxShadow: fillPct >= 80 ? '0 0 8px rgba(198,241,53,0.4)' : 'none',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      minWidth: '36px',
                      textAlign: 'right',
                      fontWeight: 600,
                    }}
                  >
                    {occ.confirmed}/{occ.total}
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

        {/* Currently filling */}
        {filling.length > 0 && (
          <Card style={{ padding: '1.4rem', border: '1px solid rgba(255,184,0,0.16)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  letterSpacing: '-0.025em',
                }}
              >
                Currently filling
              </div>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--amber)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span className="live-dot" />
                Live
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filling.map(s => {
                const count = totalPlayers(s)
                const pct = (count / s.slots.max_players) * 100
                return (
                  <Link key={s.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                    <div
                      className="dash-session-row"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1rem',
                        background: 'var(--surface2)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                            {s.slots.start_time.slice(0, 5)}–{s.slots.end_time.slice(0, 5)}
                          </div>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              color: typeColors[s.slots.type] ?? 'var(--text-secondary)',
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {typeLabels[s.slots.type]}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '4px',
                              background: 'rgba(255,255,255,0.08)',
                              borderRadius: '100px',
                              overflow: 'hidden',
                              maxWidth: '140px',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                borderRadius: '100px',
                                background: pct >= 70 ? 'var(--amber)' : 'var(--green)',
                                width: `${pct}%`,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {formatDate(s.slots.date)}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                        <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--amber)', letterSpacing: '-0.03em' }}>
                          {count}/{s.slots.max_players}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>players</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
