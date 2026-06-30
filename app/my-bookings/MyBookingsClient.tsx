'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const BMP_SESSIONS_KEY = 'bmp_my_sessions'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

interface BookingCard {
  sessionId: string
  status: string
  date: string
  startTime: string
  endTime: string
  type: string
  price: number
  playerCount: number
  venueName: string
  gameType: string
  matchedSessionId: string | null
}

interface RawSlot {
  date: string
  start_time: string
  end_time: string
  type: string
  price: number
  venues: { name: string } | null
}

interface RawSession {
  id: string
  status: string
  game_type: string
  matched_session_id?: string | null
  slots: RawSlot | RawSlot[] | null
  players: { count: number }[]
}

function gameTypeBadge(gameType: string) {
  if (gameType === 'looking_for_opposition') {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: '6px',
        background: 'rgba(198,241,53,0.08)',
        color: '#C6F135',
        border: '1px solid rgba(198,241,53,0.18)',
        letterSpacing: '0.01em',
        marginTop: '5px',
      }}>
        ⚡ Looking for opposition
      </span>
    )
  }
  if (gameType === 'open') {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: '6px',
        background: 'rgba(34,197,94,0.08)',
        color: '#22c55e',
        border: '1px solid rgba(34,197,94,0.18)',
        letterSpacing: '0.01em',
        marginTop: '5px',
      }}>
        🟢 Open game
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '11px',
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: '6px',
      background: 'rgba(255,255,255,0.05)',
      color: 'var(--muted)',
      border: '1px solid rgba(255,255,255,0.09)',
      letterSpacing: '0.01em',
      marginTop: '5px',
    }}>
      Private
    </span>
  )
}

function toCard(s: RawSession): BookingCard | null {
  const slot = Array.isArray(s.slots) ? s.slots[0] : s.slots
  if (!slot) return null
  return {
    sessionId: s.id,
    status: s.status,
    date: slot.date,
    startTime: slot.start_time.slice(0, 5),
    endTime: slot.end_time.slice(0, 5),
    type: slot.type,
    price: slot.price,
    playerCount: s.players?.[0]?.count ?? 0,
    venueName: slot.venues?.name ?? 'Globe Football Pitch',
    gameType: s.game_type ?? 'private',
    matchedSessionId: s.matched_session_id ?? null,
  }
}

export default function MyBookingsClient() {
  const [cards, setCards] = useState<BookingCard[]>([])
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: rawPlayers } = await supabase
          .from('players')
          .select(`
            joined_at,
            sessions(
              id, status, game_type, matched_session_id,
              slots(date, start_time, end_time, type, price, venues(name)),
              players(count)
            )
          `)
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false })

        const result: BookingCard[] = []
        ;((rawPlayers ?? []) as unknown as { sessions: RawSession | null }[]).forEach(p => {
          const c = p.sessions ? toCard(p.sessions) : null
          if (c) result.push(c)
        })
        setCards(result)
      } else {
        setIsGuest(true)
        let stored: { sessionId: string }[] = []
        try {
          const raw = JSON.parse(localStorage.getItem(BMP_SESSIONS_KEY) ?? '[]')
          if (Array.isArray(raw)) stored = raw
        } catch {}

        if (stored.length > 0) {
          const ids = stored.map(b => b.sessionId)
          const { data } = await supabase
            .from('sessions')
            .select(`
              id, status, game_type, matched_session_id,
              slots!inner(date, start_time, end_time, type, price, venues(name)),
              players(count)
            `)
            .in('id', ids)

          const sessMap = new Map<string, RawSession>()
          ;((data ?? []) as unknown as RawSession[]).forEach(s => sessMap.set(s.id, s))
          setCards(
            stored
              .map(b => { const s = sessMap.get(b.sessionId); return s ? toCard(s) : null })
              .filter((c): c is BookingCard => c !== null)
          )
        }
      }

      setLoading(false)
    }

    load()
  }, [])

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
  const byDate = (a: BookingCard, b: BookingCard) =>
    (a.date + 'T' + a.startTime).localeCompare(b.date + 'T' + b.startTime)
  const upcoming = cards.filter(c => c.status !== 'cancelled' && c.date >= todayStr).sort(byDate)
  const cancelled = cards.filter(c => c.status === 'cancelled').sort((a, b) => b.date.localeCompare(a.date))
  const past = cards.filter(c => c.status === 'confirmed' && c.date < todayStr).sort(byDate)

  if (loading) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div style={{ color: 'var(--muted)', fontSize: '14px', fontWeight: 500 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div
          className="anim-fade-up"
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 'clamp(24px, 5vw, 32px)',
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            marginBottom: '0.4rem',
          }}
        >
          My bookings
        </div>
        <div className="anim-fade-up d-80" style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
          Games you&apos;ve joined
        </div>
      </div>

      {/* Guest device notice */}
      {isGuest && cards.length > 0 && (
        <div
          className="anim-fade-up d-100"
          style={{
            background: 'rgba(198,241,53,0.04)',
            border: '1px solid rgba(198,241,53,0.12)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.5rem',
            fontSize: '13px',
            color: 'var(--muted)',
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          Bookings are saved to this device.{' '}
          <Link href="/auth/login" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>
            Log in
          </Link>{' '}
          to access them from anywhere.
        </div>
      )}

      {/* Empty state */}
      {cards.length === 0 && (
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
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '22px',
              letterSpacing: '-0.03em',
              marginBottom: '0.6rem',
              color: 'var(--text)',
            }}
          >
            No bookings yet
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem', fontWeight: 500, lineHeight: 1.6 }}>
            Find a game time and join a game to get started.
          </div>
          <Link href="/slots" style={{ textDecoration: 'none' }}>
            <button
              className="btn-g"
              style={{
                background: 'var(--green)',
                color: 'var(--black)',
                border: 'none',
                padding: '0.9rem 2rem',
                borderRadius: '10px',
                fontFamily: "'Archivo Black', sans-serif",
                fontWeight: 900,
                fontSize: '15px',
                letterSpacing: '-0.025em',
                cursor: 'pointer',
                transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                lineHeight: 1,
              }}
            >
              Find a game time →
            </button>
          </Link>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--green)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ width: '18px', height: '2px', background: 'var(--green)', display: 'block', borderRadius: '2px' }} />
            Upcoming
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcoming.map(c => {
              const isConfirmed = c.status === 'confirmed'
              const isFilling = c.status === 'filling'
              const isAmber = c.playerCount >= 7 && c.playerCount < 10
              const perPlayer = (c.price / 10 + 0.50 + 0.30).toFixed(2)
              const segColor = isConfirmed ? 'lit-green' : isAmber ? 'lit-amber' : 'lit-green'
              return (
                <Link
                  key={c.sessionId}
                  href={`/session/${c.sessionId}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div
                    className={`booking-card ${isConfirmed ? 'booking-card-confirmed' : ''}`}
                    style={{
                      background: isConfirmed
                        ? 'linear-gradient(145deg, rgba(198,241,53,0.05) 0%, #0f0f0f 100%)'
                        : 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
                      border: `1px solid ${isConfirmed ? 'rgba(198,241,53,0.22)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: '16px',
                      padding: '1.25rem 1.5rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                      <div>
                        <div
                          style={{
                            fontFamily: "'Archivo Black', sans-serif",
                            fontSize: '22px',
                            letterSpacing: '-0.04em',
                            lineHeight: 1,
                            marginBottom: '6px',
                          }}
                        >
                          {c.startTime} – {c.endTime}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                          {c.venueName} · {formatDate(c.date)}
                        </div>
                        {gameTypeBadge(c.gameType)}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: isConfirmed ? 'rgba(198,241,53,0.1)' : 'rgba(255,184,0,0.1)',
                            color: isConfirmed ? 'var(--green)' : 'var(--amber)',
                            border: `1px solid ${isConfirmed ? 'rgba(198,241,53,0.2)' : 'rgba(255,184,0,0.2)'}`,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase' as const,
                            marginBottom: '6px',
                          }}
                        >
                          {isConfirmed && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                          )}
                          {isFilling && <span className="live-dot" style={{ width: '6px', height: '6px' }} />}
                          {isConfirmed ? 'Confirmed' : 'Filling…'}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                          £{perPlayer} if full
                        </div>
                      </div>
                    </div>

                    {/* Player count */}
                    <div className="seg-bar" style={{ marginTop: '2px', marginBottom: '8px' }}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          className={`seg-bar-seg ${i < c.playerCount ? segColor : 'unlit'}`}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                      <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{c.playerCount}/10 players</strong>
                      {c.playerCount === 9
                        ? ' — last spot!'
                        : c.playerCount < 10
                        ? ` — ${10 - c.playerCount} more needed`
                        : ' — full'}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--red)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: 0.7,
            }}
          >
            <span style={{ width: '18px', height: '2px', background: 'var(--red)', display: 'block', borderRadius: '2px', opacity: 0.5 }} />
            Cancelled
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.6 }}>
            {cancelled.map(c => {
              const perPlayer = (c.price / 10 + 0.50 + 0.30).toFixed(2)
              return (
                <div
                  key={c.sessionId}
                  style={{
                    background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
                    border: '1px solid rgba(255,68,68,0.14)',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div
                        style={{
                          fontFamily: "'Archivo Black', sans-serif",
                          fontSize: '22px',
                          letterSpacing: '-0.04em',
                          lineHeight: 1,
                          marginBottom: '6px',
                          color: 'var(--muted)',
                        }}
                      >
                        {c.startTime} – {c.endTime}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                        {c.venueName} · {formatDate(c.date)}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255,68,68,0.08)',
                          color: 'var(--red)',
                          border: '1px solid rgba(255,68,68,0.18)',
                          letterSpacing: '0.01em',
                          marginTop: '6px',
                        }}
                      >
                        {c.matchedSessionId
                          ? 'Cancelled — another team got there first'
                          : 'Cancelled by organiser'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                        £{perPlayer} if full
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/slots"
                    style={{ textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--green)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Find another game →
                    </span>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                width: '18px',
                height: '2px',
                background: 'var(--muted)',
                display: 'block',
                borderRadius: '2px',
                opacity: 0.4,
              }}
            />
            Past
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.55 }}>
            {past.map(c => (
              <Link key={c.sessionId} href={`/session/${c.sessionId}`} style={{ textDecoration: 'none' }}>
                <div
                  className="booking-card"
                  style={{
                    background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '14px',
                    padding: '1rem 1.35rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div
                        style={{
                          fontFamily: "'Archivo Black', sans-serif",
                          fontSize: '18px',
                          letterSpacing: '-0.03em',
                          lineHeight: 1,
                          marginBottom: '4px',
                        }}
                      >
                        {c.startTime} – {c.endTime}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                        {c.venueName} · {formatDate(c.date)}
                      </div>
                      {gameTypeBadge(c.gameType)}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Played ✓
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500, marginTop: '2px' }}>
                        {c.playerCount}/10 players
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
