'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { readMySessions } from '@/lib/clientStorage'
import { getSlotType, scheduleFromVenue, VenueSchedule } from '@/lib/slots'

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
  maxPlayers: number
  playerCount: number
  venueName: string
  gameType: string
  organiserName: string | null
  slotTakenByRival: boolean
}

interface RawSlot {
  date: string
  start_time: string
  end_time: string
  price: number
  pitches: { max_players: number }
  venues: (Partial<VenueSchedule> & { name: string }) | null
  sessions: { status: string }[] | null
}

interface RawSession {
  id: string
  status: string
  game_type: string
  organiser_name: string | null
  slots: RawSlot | RawSlot[] | null
  players: { count: number }[]
}

// ── Icons — small line-art SVGs, currentColor so they inherit surrounding text colour ──
function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6V8l2.6 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 14.5s5-4.2 5-8.2A5 5 0 0 0 3 6.3c0 4 5 8.2 5 8.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="6.3" r="1.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 13c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11.5" cy="5.5" r="1.7" stroke="currentColor" strokeWidth="1.3" opacity="0.75" />
      <path d="M9.8 9.6c1.8.2 3.2 1.5 3.2 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2v4M8 5.2v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ── Shared pill style — matches components/ui/Badge visual language ──
function pillStyle(color: string, bg: string, border: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontFamily: 'var(--font-sans)',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    background: bg,
    color,
    border: `1px solid ${border}`,
    letterSpacing: '0.03em',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  }
}

// Status badge — Filling (amber) / Confirmed (lime) / Cancelled (grey), driven directly by c.status
function statusPillInfo(status: string): { label: string; color: string; bg: string; border: string } {
  if (status === 'confirmed') {
    return { label: 'Confirmed', color: 'var(--green)', bg: 'rgba(198,241,53,0.1)', border: 'rgba(198,241,53,0.2)' }
  }
  if (status === 'cancelled') {
    return { label: 'Cancelled', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' }
  }
  return { label: 'Filling', color: 'var(--amber)', bg: 'rgba(255,184,0,0.1)', border: 'rgba(255,184,0,0.2)' }
}

// Slot type badge — Peak / Off-peak / Weekend
function slotTypeInfo(type: string): { label: string; variant: 'peak' | 'offpeak' | 'weekend' } {
  if (type === 'peak') return { label: 'Peak', variant: 'peak' }
  if (type === 'weekend') return { label: 'Weekend', variant: 'weekend' }
  return { label: 'Off-peak', variant: 'offpeak' }
}

// Game type badge — Public (open) / Private
function gameTypeInfo(gameType: string): { label: string; variant: 'public' | 'neutral' } | null {
  if (gameType === 'open') return { label: 'Public', variant: 'public' }
  if (gameType === 'private') return { label: 'Private', variant: 'neutral' }
  return null
}

function cancelReasonText(c: BookingCard): string | null {
  if (c.status !== 'cancelled') return null
  if (c.slotTakenByRival) return 'Cancelled: slot taken by another group'
  return 'Cancelled by organiser'
}

function SectionLabel({
  label,
  color,
  lineColor,
  opacity = 1,
  lineOpacity = 1,
}: {
  label: string
  color: string
  lineColor: string
  opacity?: number
  lineOpacity?: number
}) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-sans)',
        color,
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        opacity,
      }}
    >
      <span style={{ width: '18px', height: '2px', background: lineColor, display: 'block', borderRadius: '2px', opacity: lineOpacity }} />
      {label}
    </div>
  )
}

// ── Booking card — Champz-style card (homepage / slots public game cards), no photo area ──
function BookingCardTile({ c, dimmed = false, animationDelay }: { c: BookingCard; dimmed?: boolean; animationDelay?: string }) {
  const status = statusPillInfo(c.status)
  const typeInfo = slotTypeInfo(c.type)
  const gameTypeBadge = gameTypeInfo(c.gameType)
  const perPlayer = (c.price / c.maxPlayers + 0.50 + 0.30).toFixed(2)
  const reason = cancelReasonText(c)

  return (
    <Link href={`/session/${c.sessionId}`} className="anim-fade-up" style={{ textDecoration: 'none', display: 'block', animationDelay }}>
      <div
        className="booking-card"
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '1.2rem',
          cursor: 'pointer',
          opacity: dimmed ? 0.6 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '0.9rem' }}>
          <span style={pillStyle(status.color, status.bg, status.border)}>
            {c.status === 'filling' && <span className="live-dot" style={{ width: '6px', height: '6px' }} />}
            {status.label}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: 'var(--green)', color: 'var(--black)',
              fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            <PeopleIcon /> {c.playerCount}/{c.maxPlayers} players
          </span>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
            letterSpacing: '-0.01em', color: 'var(--text)', lineHeight: 1.2, marginBottom: '8px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {c.organiserName ? `${c.organiserName}'s game` : "Public game"}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px' }}>
          <ClockIcon /> {formatDate(c.date)} · {c.startTime}–{c.endTime}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: reason ? '4px' : '0.9rem' }}>
          <PinIcon /> {c.venueName}
        </div>
        {reason && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: '0.9rem' }}>
            {reason}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
            {gameTypeBadge && <Badge variant={gameTypeBadge.variant}>{gameTypeBadge.label}</Badge>}
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>
            £{perPlayer} <span style={{ fontWeight: 600, opacity: 0.85, fontSize: '11px' }}>per player</span>
          </span>
        </div>
      </div>
    </Link>
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
    type: getSlotType(slot.date, slot.start_time, scheduleFromVenue(slot.venues)),
    price: slot.price,
    maxPlayers: slot.pitches.max_players,
    playerCount: s.players?.[0]?.count ?? 0,
    venueName: slot.venues?.name ?? 'your local pitch',
    gameType: s.game_type ?? 'private',
    organiserName: s.organiser_name ?? null,
    slotTakenByRival: (slot.sessions ?? []).some(sib => sib.status === 'confirmed'),
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
              id, status, game_type, organiser_name,
              slots(date, start_time, end_time, price, pitches(max_players), venues(name, opening_time, closing_time, weekend_opening_time, weekend_closing_time, peak_start_time), sessions(status)),
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
          stored = readMySessions()
        } catch {}

        if (stored.length > 0) {
          const ids = stored.map(b => b.sessionId)
          const { data } = await supabase
            .from('sessions')
            .select(`
              id, status, game_type, organiser_name,
              slots!inner(date, start_time, end_time, price, pitches(max_players), venues(name, opening_time, closing_time, weekend_opening_time, weekend_closing_time, peak_start_time), sessions(status)),
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
  const upcoming = cards.filter(c => c.status === 'confirmed' && c.date >= todayStr).sort(byDate)
  const filling = cards.filter(c => c.status === 'filling' && c.date >= todayStr).sort(byDate)
  const past = cards.filter(c => c.status === 'confirmed' && c.date < todayStr).sort(byDate)
  const cancelled = cards.filter(c => c.status === 'cancelled').sort(byDate)

  if (loading) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: 'clamp(2rem, 6vh, 2.5rem) clamp(1rem, 4vw, 1.5rem) 4rem' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="skeleton" style={{ width: '160px', height: '14px', borderRadius: '4px', marginBottom: '0.75rem' }} />
          <div className="skeleton" style={{ width: '220px', height: '30px', borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[0, 1].map(i => (
            <div
              key={i}
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '1.2rem',
              }}
            >
              <div className="skeleton" style={{ width: '75%', height: '20px', borderRadius: '5px', marginBottom: '10px' }} />
              <div className="skeleton" style={{ width: '50%', height: '13px', borderRadius: '4px', marginBottom: '14px' }} />
              <div className="skeleton" style={{ width: '100%', height: '7px', borderRadius: '3px' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: 'clamp(2rem, 6vh, 2.5rem) clamp(1rem, 4vw, 1.5rem) 4rem' }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: '2.5rem' }}>
        <SectionHeading
          eyebrow="Your games"
          heading="My bookings"
          sub="Games you've joined"
        />
      </div>

      {/* Guest device notice */}
      {isGuest && cards.length > 0 && (
        <div
          className="anim-fade-up d-100"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'rgba(198,241,53,0.04)',
            border: '1px solid rgba(198,241,53,0.12)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.5rem',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: 'var(--green)', marginTop: '2px' }}><InfoIcon /></span>
          <span>
            Bookings are saved to this device.{' '}
            <Link href="/auth/login" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>
              Log in
            </Link>{' '}
            to access them from anywhere.
          </span>
        </div>
      )}

      {/* Empty state */}
      {cards.length === 0 && (
        <Card
          className="anim-fade-up d-100"
          style={{ textAlign: 'center', padding: 'clamp(3rem, 10vw, 4rem) 1.5rem' }}
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
              color: 'var(--green)',
            }}
          >
            <CalendarIcon />
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
            No bookings yet
          </div>
          <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '2rem', fontWeight: 500, lineHeight: 1.6 }}>
            Find a game and join to get started.
          </div>
          <Link href="/slots" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg" arrow>Find a game tonight</Button>
          </Link>
        </Card>
      )}

      {/* Confirmed — Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <SectionLabel label="Confirmed: Upcoming" color="var(--green)" lineColor="var(--green)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcoming.map((c, idx) => (
              <BookingCardTile key={c.sessionId} c={c} animationDelay={`${idx * 60}ms`} />
            ))}
          </div>
        </div>
      )}

      {/* Filling */}
      {filling.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <SectionLabel label="Filling" color="var(--amber)" lineColor="var(--amber)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filling.map((c, idx) => (
              <BookingCardTile key={c.sessionId} c={c} animationDelay={`${idx * 60}ms`} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <SectionLabel label="Past" color="var(--text-secondary)" lineColor="var(--muted)" lineOpacity={0.4} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {past.map(c => (
              <BookingCardTile key={c.sessionId} c={c} dimmed />
            ))}
          </div>
        </div>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <div>
          <SectionLabel label="Cancelled" color="var(--text-secondary)" lineColor="var(--muted)" opacity={0.7} lineOpacity={0.4} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cancelled.map(c => (
              <BookingCardTile key={c.sessionId} c={c} dimmed />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
