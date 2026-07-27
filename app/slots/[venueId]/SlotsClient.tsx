'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSlotsForDay, getSlotType, formatPerPlayer, OPENING_HOURS, SlotTemplate, Pitch } from '@/lib/slots'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Footer } from '@/components/Footer'
import { SectionHeading } from '@/components/ui/SectionHeading'

export interface SessionData {
  id: string
  slot_id: string
  organiser_id: string | null
  status: string
  organiser_name: string | null
  is_public: boolean
  game_type: string | null
  slot_ids: string[] | null
  slots: {
    id: string
    date: string
    start_time: string
    end_time: string
    price: number
    max_players: number
    venue_id: string
    pitches: Pitch
  }
  players: { count: number }[]
}

export interface DbSlot {
  id: string
  date: string
  start_time: string
  price: number
  pitches: Pitch
}

interface Props {
  initialSessions: SessionData[]
  dbSlots: DbSlot[]
  venueId: string
  venueName: string
  venueAddress: string
  pitches: Pitch[]
  userSlotSessionMap: Record<string, string>
  userSessionIds: string[]
  userId: string | null
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const CARD_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CARD_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const infoCardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
  padding: 'clamp(1.25rem, 3vw, 1.75rem)',
  marginBottom: '1.25rem',
}

const infoCardHeading: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--text)',
  margin: 0,
}

const hoursRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.75rem 0.875rem',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '8px',
}

function fmtCardDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${CARD_DAY_NAMES[d.getDay()]} ${d.getDate()} ${CARD_MONTH_NAMES[d.getMonth()]}`
}

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

function BallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6l2.4 1.7-0.9 2.8H6.5l-0.9-2.8L8 4.6ZM8 11.4v1.8M3.2 9.6l1.7-1M11.1 8.6l1.7 1M4.9 6.6L3.4 5.4M11.1 6.6l1.5-1.2" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" fill="var(--green-faint)" stroke="var(--green)" strokeWidth="1" />
      <path d="M5 8.2l2 2 4-4.4" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SlotsClient({ initialSessions, dbSlots, venueId, venueName, venueAddress, pitches, userSlotSessionMap, userSessionIds, userId }: Props) {
  const userSessionSet = new Set(userSessionIds)
  const router = useRouter()
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState(60)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [selectedPitchId, setSelectedPitchId] = useState(() => pitches[0]?.id ?? '')

  const selectedPitch = pitches.find(p => p.id === selectedPitchId) ?? pitches[0]

  // Slots are keyed by pitch+date+time — a venue with multiple pitches (e.g.
  // a 5-a-side and a 7-a-side) can have a slot at the same date/time per pitch.
  const [slotDataMap, setSlotDataMap] = useState<Map<string, DbSlot>>(
    () => new Map(dbSlots.map(s => [`${s.pitches.id}_${s.date}_${s.start_time.slice(0, 5)}`, s]))
  )

  // Sessions belonging to the pitch currently selected in the tab bar.
  const pitchSessions = sessions.filter(s => {
    const slot = Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots
    return slot?.pitches.id === selectedPitchId
  })

  const today = startOfDay(new Date())
  const weekDays = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  const dateScrollRef = useRef<HTMLDivElement>(null)
  const scrollDatesBy = (direction: 1 | -1) => {
    const el = dateScrollRef.current
    if (!el) return
    const cardWidth = el.scrollWidth / weekDays.length
    el.scrollBy({ left: direction * cardWidth, behavior: 'smooth' })
  }

  useEffect(() => {
    const channel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, refresh)
      .subscribe()

    function refresh() {
      const nowStr = formatDate(startOfDay(new Date()))
      const endStr = formatDate(addDays(startOfDay(new Date()), 14))
      supabase
        .from('sessions')
        .select('id, slot_id, organiser_id, status, organiser_name, is_public, game_type, slot_ids, slots!inner(id, date, start_time, end_time, price, max_players, venue_id, pitches(id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price)), players(count)')
        .eq('slots.venue_id', venueId)
        .gte('slots.date', nowStr)
        .lte('slots.date', endStr)
        .in('status', ['filling', 'confirmed'])
        .then(({ data }) => { if (data) setSessions(data as unknown as SessionData[]) })
    }

    return () => { supabase.removeChannel(channel) }
  }, [])

  const dayStr = formatDate(selectedDate)
  const rawSlotTemplates = getSlotsForDay(selectedDate)
  // Hide slots on today's date whose start time has already passed.
  const nowTimeStr = dayStr === formatDate(new Date())
    ? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    : null
  const slotTemplates = nowTimeStr
    ? rawSlotTemplates.filter(t => t.startTime > nowTimeStr)
    : rawSlotTemplates

  // ── Per-slot session maps ────────────────────────────────────────────────
  const daySessionMap = new Map<string, SessionData[]>()
  pitchSessions.forEach(s => {
    const slot = Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots
    if (slot?.date === dayStr) {
      const key = slot.start_time.slice(0, 5)
      if (!daySessionMap.has(key)) daySessionMap.set(key, [])
      daySessionMap.get(key)!.push({ ...s, slots: slot })
    }
  })

  // ── Open games for the selected day ─────────────────────────────────────
  // Source: same `sessions` state (game_type === 'open', filling).
  // No new data fetching — purely derived from existing sessions array.
  type NormalisedSession = Omit<SessionData, 'slots'> & { slots: SessionData['slots'] }
  const dayOpenGames: NormalisedSession[] = pitchSessions
    .filter(s => {
      const slot = Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots
      return (
        slot?.date === dayStr &&
        s.status === 'filling' &&
        s.game_type === 'open' &&
        !userSessionSet.has(s.id)
      )
    })
    .map(s => ({
      ...s,
      slots: Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots,
    }))
    .sort((a, b) => totalCount(b as SessionData) - totalCount(a as SessionData))

  // Every slot id locked by a confirmed session — either as its primary slot_id
  // or as one of the other hours in a multi-hour (60/120/180 min) booking's
  // slot_ids array. A slot in here is booked and non-clickable everywhere,
  // even if it isn't the primary slot of the session that confirmed it.
  const confirmedSlotIdSet = new Set<string>()
  pitchSessions.forEach(s => {
    if (s.status !== 'confirmed') return
    const ids = s.slot_ids && s.slot_ids.length > 0 ? s.slot_ids : [s.slot_id]
    ids.forEach(id => confirmedSlotIdSet.add(id))
  })

  function getSlotStatus(template: SlotTemplate) {
    const dbSlot = slotDataMap.get(`${selectedPitchId}_${dayStr}_${template.startTime}`) ?? null
    const slotId = dbSlot?.id ?? null

    if (slotId && confirmedSlotIdSet.has(slotId)) {
      return { status: 'booked' as const, hasRival: false, playerCount: dbSlot?.pitches.max_players ?? 0, sessionId: null, slotId }
    }

    const slotSessions = daySessionMap.get(template.startTime) ?? []
    const filling = slotSessions.filter(s => s.status === 'filling')
    if (filling.length === 0) {
      return { status: 'empty' as const, hasRival: false, playerCount: 0, sessionId: null, slotId }
    }

    const hasRival = filling.length > 1
    const best = filling.reduce((a, b) => totalCount(a) >= totalCount(b) ? a : b)
    const bestCount = totalCount(best)

    const RIVAL_THRESHOLD = 7
    if (bestCount < RIVAL_THRESHOLD) {
      return { status: 'empty' as const, hasRival: false, playerCount: 0, sessionId: null, slotId }
    }

    return { status: 'filling' as const, hasRival, playerCount: bestCount, sessionId: null, slotId }
  }

  function totalCount(s: SessionData): number {
    return (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
  }

  // "Available only" hides booked slots — client-side filter, no new fetching
  const visibleTemplates = availableOnly
    ? slotTemplates.filter(t => getSlotStatus(t).status !== 'booked')
    : slotTemplates

  // Detail panel derives from visibleTemplates so it hides if the selected time
  // gets filtered out when the user toggles "Available only"
  const selectedTemplate = selectedTime
    ? visibleTemplates.find(t => t.startTime === selectedTime) ?? null
    : null
  const selectedInfo = selectedTemplate ? getSlotStatus(selectedTemplate) : null

  // ── Multi-hour duration + booking summary ──────────────────────────────
  // Hoisted to component level (rather than only computed once a time is
  // picked) so both the time-pill range highlighting and the always-visible
  // proceed button below can read it.
  const slotSessionsForSelected = selectedTemplate ? (daySessionMap.get(selectedTemplate.startTime) ?? []) : []
  const userSlotSessionsSelected = slotSessionsForSelected.filter(s => userSessionSet.has(s.id))
  const openSessionsSelected = slotSessionsForSelected.filter(
    s => s.status === 'filling' && s.game_type === 'open' && !userSessionSet.has(s.id)
  )
  const allPublicSessionsSelected = [...openSessionsSelected].sort((a, b) => totalCount(b) - totalCount(a))
  const userSessionIdSelected = userId
    ? userSlotSessionsSelected.find(s => s.organiser_id === userId)?.id
    : undefined

  const bookedSelected = selectedInfo?.status === 'booked'

  // Each duration option requires N consecutive hourly templates starting at
  // the selected time. slotTemplates is chronologically contiguous (each
  // slot's endTime === the next slot's startTime), so consecutive array
  // indices are consecutive hour blocks.
  const startIdx = selectedTemplate ? slotTemplates.findIndex(t => t.startTime === selectedTemplate.startTime) : -1
  function requiredTemplatesFor(durationMins: number): SlotTemplate[] | null {
    const count = durationMins / 60
    if (startIdx === -1) return null
    const slice = slotTemplates.slice(startIdx, startIdx + count)
    return slice.length === count ? slice : null
  }
  function durationAvailable(durationMins: number): boolean {
    const templates = requiredTemplatesFor(durationMins)
    if (!templates) return false
    return templates.every(t => getSlotStatus(t).status !== 'booked')
  }

  const requiredTemplates = selectedTemplate ? (requiredTemplatesFor(selectedDuration) ?? [selectedTemplate]) : []
  // Every start time covered by the current time+duration selection — used to
  // highlight all the slots a multi-hour booking fills, not just the one clicked.
  const requiredStartTimes = new Set(requiredTemplates.map(t => t.startTime))
  const requiredDbSlots = requiredTemplates
    .map(t => slotDataMap.get(`${selectedPitchId}_${dayStr}_${t.startTime}`))
    .filter((s): s is DbSlot => !!s)
  const requiredSlotIds = requiredDbSlots.map(s => s.id)
  const durationFullyAvailable = !!selectedTemplate
    && requiredSlotIds.length === requiredTemplates.length
    && requiredTemplates.every(t => getSlotStatus(t).status !== 'booked')
  const rangeEndTime = requiredTemplates[requiredTemplates.length - 1]?.endTime ?? selectedTemplate?.endTime ?? ''
  const totalPriceGBP = requiredDbSlots.reduce((sum, s) => sum + s.price, 0)
  const bookingMaxPlayers = requiredDbSlots[0]?.pitches.max_players ?? selectedInfo?.playerCount ?? 0

  const createHref = selectedTemplate && !bookedSelected && !userSessionIdSelected && durationFullyAvailable && requiredSlotIds.length > 0
    ? `/slots/create/${requiredSlotIds[0]}?slotIds=${requiredSlotIds.join(',')}`
    : undefined
  const fillingFastSelected = !!selectedTemplate && !bookedSelected && !userSessionIdSelected && allPublicSessionsSelected.some(s => totalCount(s) >= 7)
  const typeLabelSelected = selectedTemplate
    ? (selectedTemplate.type === 'peak' ? 'Peak' : selectedTemplate.type === 'offpeak' ? 'Off-peak' : 'Weekend')
    : ''
  const perPlayerPriceSelected = bookingMaxPlayers > 0 ? (totalPriceGBP / bookingMaxPlayers).toFixed(2) : '0.00'

  return (
    <>
    <div style={{ paddingBottom: '5rem' }}>
      <Container>
        <div style={{ paddingTop: '2.25rem' }}>

          {/* ── BREADCRUMB ───────────────────────────────────── */}
          <nav
            aria-label="Breadcrumb"
            className="anim-fade-up"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.5rem', fontSize: '13px', fontWeight: 500 }}
          >
            <Link href="/" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Home</Link>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <Link href="/slots" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Venues</Link>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span style={{ color: 'var(--text)' }}>{venueName}</span>
          </nav>

          <div className="venue-layout">

              {/* Hero card */}
              <div
                className="anim-fade-up d-40 venue-area-hero"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-card)',
                  padding: 'clamp(1.5rem, 4vw, 2.25rem)',
                  marginBottom: '1.25rem',
                }}
              >
                <Badge variant="public"><BallIcon /> Football</Badge>
                <h1
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                    color: 'var(--text)',
                    margin: '0.875rem 0 0.6rem',
                  }}
                >
                  {venueName}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, marginBottom: '1.5rem' }}>
                  <PinIcon />
                  {venueAddress}
                </div>

                <div className="venue-hero-stats">
                  <div className="venue-stat-tile">
                    <span className="venue-stat-label">Surface</span>
                    <span className="venue-stat-value">{selectedPitch?.surface ?? '—'}</span>
                  </div>
                  <div className="venue-stat-tile">
                    <span className="venue-stat-label">Format</span>
                    <span className="venue-stat-value">{selectedPitch?.format ?? '—'}</span>
                  </div>
                  <div className="venue-stat-tile">
                    <span className="venue-stat-label">From</span>
                    <span className="venue-stat-value" style={{ color: 'var(--green)' }}>
                      {selectedPitch ? formatPerPlayer(selectedPitch.offpeak_price, selectedPitch.max_players) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description — composed from real venue/pitch fields, no invented copy */}
              <div className="anim-fade-up d-80 venue-area-description" style={infoCardStyle}>
                <h3 style={{ ...infoCardHeading, marginBottom: '0.875rem' }}>Description</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  {pitches.length > 1
                    ? `${venueName} has ${pitches.length} pitches available — ${pitches.map(p => p.format).join(' and ')} — on ${Array.from(new Set(pitches.map(p => p.surface))).join('/')} surface, located at ${venueAddress}.`
                    : `${venueName} features a ${selectedPitch?.format} football pitch on ${selectedPitch?.surface} surface, located at ${venueAddress}.`}
                </p>
              </div>

              {/* Opening Hours — derived from the actual bookable time window in lib/slots.ts */}
              <div className="anim-fade-up d-100 venue-area-hours" style={infoCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.875rem' }}>
                  <ClockIcon />
                  <h3 style={infoCardHeading}>Opening Hours</h3>
                </div>
                <div style={hoursRowStyle}>
                  <span>Weekdays</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>{OPENING_HOURS.weekday.start} – {OPENING_HOURS.weekday.end}</span>
                </div>
                <div style={{ ...hoursRowStyle, marginBottom: 0 }}>
                  <span>Weekends</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>{OPENING_HOURS.weekend.start} – {OPENING_HOURS.weekend.end}</span>
                </div>
              </div>

              {/* Location — real embed built from the venue's actual address, no API key required */}
              <div className="anim-fade-up d-120 venue-area-location" style={infoCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.875rem' }}>
                  <PinIcon />
                  <h3 style={infoCardHeading}>Location</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 1rem' }}>{venueAddress}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName}, ${venueAddress}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '200px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                    background: 'radial-gradient(circle at 50% 40%, var(--surface3), var(--surface2))',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <svg width="30" height="30" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--green)' }}>
                      <path d="M8 14.5s5-4.2 5-8.2A5 5 0 0 0 3 6.3c0 4 5 8.2 5 8.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                      <circle cx="8" cy="6.3" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Tap to view on Google Maps</span>
                  </span>
                </a>
              </div>

              {/* ── OPEN GAMES ───────────────────────────────────── */}
              {/* Data source: `sessions` state (same fetch as time slots), game_type === 'open',
                  filtered to the selected day. No new data fetching. */}
              <div className="anim-fade-up d-150 venue-area-games">
                <div style={{ marginBottom: '1.25rem' }}>
                  <SectionHeading
                    eyebrow="Public Games"
                    heading="Join a game"
                  />
                </div>

                {dayOpenGames.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '1.5rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xl)',
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.2, flexShrink: 0 }}>
                      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, fontWeight: 400 }}>
                      No public games today — create one from the booking panel
                    </p>
                  </div>
                ) : (
                  <div className="open-games-scroller">
                    {dayOpenGames.map((s, idx) => {
                      const slot = s.slots
                      const playerCount = totalCount(s as SessionData)
                      const maxPlayers = slot.pitches.max_players
                      const perPlayer = (slot.price / maxPlayers).toFixed(2)
                      const title = s.organiser_name ? `${s.organiser_name}'s game` : 'Public game'
                      const slotType = getSlotType(slot.date, slot.start_time)
                      const typeVariant = slotType === 'peak' ? 'peak' : slotType === 'weekend' ? 'weekend' : 'offpeak'
                      const typeLabel = slotType === 'peak' ? 'Peak' : slotType === 'weekend' ? 'Weekend' : 'Off-peak'

                      return (
                        <Link
                          key={s.id}
                          href={`/session/${s.id}`}
                          className="open-game-card-link"
                          style={{ animationName: 'fadeUp', animationDuration: '0.45s', animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)', animationFillMode: 'both', animationDelay: `${idx * 60}ms`, cursor: 'pointer' }}
                        >
                          <div className="open-game-card" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {/* Top half — pitch photo */}
                            <div
                              style={{
                                position: 'relative',
                                height: '180px',
                                backgroundImage: "url('/slot-card.jpg')",
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(8,8,8,0.45)',
                                  pointerEvents: 'none',
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute', top: '10px', left: '10px',
                                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  padding: '4px 10px', borderRadius: 'var(--radius-full)',
                                  background: 'var(--green)', color: 'var(--black)',
                                  fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
                                  letterSpacing: '0.02em',
                                }}
                              >
                                <PeopleIcon /> {playerCount}/{maxPlayers} players
                              </div>
                            </div>

                            {/* Bottom half — game details */}
                            <div style={{ background: '#0e0e0e', padding: '1rem 1.2rem' }}>
                              <div
                                style={{
                                  fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                                  letterSpacing: '-0.01em', color: '#fff', lineHeight: 1.2, marginBottom: '6px',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                              >
                                {title}
                              </div>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontFamily: 'var(--font-sans)', fontSize: '12px',
                                color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '4px',
                              }}>
                                <ClockIcon /> {fmtCardDate(slot.date)} · {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                              </div>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontFamily: 'var(--font-sans)', fontSize: '12px',
                                color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.9rem',
                              }}>
                                <PinIcon /> {venueName}{venueAddress ? ` · ${venueAddress}` : ''}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <Badge variant={typeVariant}>{typeLabel}</Badge>
                                <div style={{
                                  display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                                  padding: '5px 12px', borderRadius: 'var(--radius-full)',
                                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>
                                    £{perPlayer}
                                  </span>
                                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--green)', opacity: 0.85 }}>
                                    per player
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

            {/* ── STICKY BOOKING PANEL ─────────────────────────── */}
            <div className="venue-area-panel">
              <div className="booking-panel-sticky">
                <div className="booking-panel anim-fade-up d-60">

                  {/* Panel header */}
                  <div className="booking-panel-header">
                    <span
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'rgba(8,8,8,0.55)',
                        marginBottom: '6px',
                      }}
                    >
                      Reserve your spot
                    </span>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--black)' }}>
                      Book a slot
                    </div>
                  </div>

                  <div className="booking-panel-body">

          {/* ── DAY SELECTOR ─────────────────────────────────── */}
          <div style={{ marginBottom: '1.75rem' }}>
            {/* Row: eyebrow + Available only toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <Eyebrow color="secondary">Select Day</Eyebrow>
              <button
                onClick={() => setAvailableOnly(o => !o)}
                aria-pressed={availableOnly}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: availableOnly ? 'var(--green)' : 'var(--surface3)',
                    border: `1px solid ${availableOnly ? 'transparent' : 'var(--border)'}`,
                    position: 'relative',
                    transition: 'background 160ms ease, border-color 160ms ease',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: availableOnly ? '16px' : '2px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: availableOnly ? 'var(--black)' : 'var(--text-tertiary)',
                      transition: 'left 160ms ease, background 160ms ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: availableOnly ? 'var(--text)' : 'var(--text-tertiary)',
                    transition: 'color 160ms ease',
                    letterSpacing: '0.02em',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Available only
                </span>
              </button>
            </div>

            {/* Date row — horizontal scroll on mobile, arrow nav on desktop */}
            <div className="date-picker-wrap">
              <button
                type="button"
                className="date-arrow date-arrow-left"
                onClick={() => scrollDatesBy(-1)}
                aria-label="Previous dates"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="date-picker-row" ref={dateScrollRef}>
              {weekDays.map(day => {
                const active = formatDate(day) === dayStr
                const isPast = day < today
                return (
                  <button
                    key={formatDate(day)}
                    className={active ? 'day-chip day-chip-active' : 'day-chip'}
                    onClick={() => {
                      if (!isPast) {
                        setSelectedDate(startOfDay(day))
                        setSelectedTime(null)
                        setSelectedDuration(60)
                      }
                    }}
                    disabled={isPast}
                    aria-pressed={active}
                    style={{
                      padding: '10px 4px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid',
                      borderColor: active ? 'transparent' : 'var(--border)',
                      background: active ? 'var(--green)' : 'var(--surface)',
                      cursor: isPast ? 'not-allowed' : 'pointer',
                      opacity: isPast ? 0.25 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      minHeight: '76px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: active ? 'rgba(8,8,8,0.5)' : 'var(--text-tertiary)',
                        lineHeight: 1,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {DAY_NAMES[day.getDay()]}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '22px',
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                        color: active ? 'var(--black)' : isPast ? 'var(--text-tertiary)' : 'var(--text)',
                      }}
                    >
                      {day.getDate()}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: active ? 'rgba(8,8,8,0.4)' : 'var(--text-tertiary)',
                        lineHeight: 1,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {MONTH_SHORT[day.getMonth()]}
                    </span>
                  </button>
                )
              })}
              </div>
              <button
                type="button"
                className="date-arrow date-arrow-right"
                onClick={() => scrollDatesBy(1)}
                aria-label="Next dates"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── START TIME ───────────────────────────────────── */}
          <div style={{ marginBottom: selectedTemplate ? '1.5rem' : '0.5rem' }}>
            <div style={{ marginBottom: '0.875rem' }}>
              <Eyebrow color="secondary">Start Time</Eyebrow>
            </div>

            {slotTemplates.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '3.5rem 1rem',
                  textAlign: 'center',
                  gap: '12px',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ opacity: 0.18 }}>
                  <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M18 11v7M18 21v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, fontWeight: 400 }}>
                  No game times here — try another day
                </p>
              </div>
            ) : (
              <div className="time-pills-grid">
                {visibleTemplates.map((template, idx) => {
                  const info = getSlotStatus(template)
                  const booked = info.status === 'booked'
                  // Highlight every slot the current duration selection would fill,
                  // not just the one that was clicked (e.g. both hours of a 120 min booking).
                  const isSelected = selectedTime === template.startTime || requiredStartTimes.has(template.startTime)
                  const isPeak = template.type === 'peak'

                  const slotSessionsForTime = daySessionMap.get(template.startTime) ?? []
                  const userSlotSessions = slotSessionsForTime.filter(s => userSessionSet.has(s.id) && s.status !== 'cancelled')
                  const hasUserSession = userSlotSessions.length > 0

                  const subtextLabel = hasUserSession
                    ? 'Your game'
                    : booked
                      ? 'Booked'
                      : isPeak ? 'Peak' : 'Off-peak'

                  const subtextColor = isSelected
                    ? 'rgba(8,8,8,0.45)'
                    : hasUserSession
                      ? 'var(--green)'
                      : booked
                        ? 'var(--text-tertiary)'
                        : isPeak
                          ? 'var(--amber)'
                          : 'var(--text-tertiary)'

                  const pillBorderColor = isSelected
                    ? 'transparent'
                    : hasUserSession
                      ? 'rgba(198,241,53,0.4)'
                      : isPeak
                        ? 'rgba(255,184,0,0.22)'
                        : 'var(--border)'

                  const pillBg = isSelected
                    ? 'var(--green)'
                    : hasUserSession
                      ? 'rgba(198,241,53,0.06)'
                      : 'var(--surface)'

                  const pillShadow = isSelected
                    ? 'var(--shadow-glow)'
                    : hasUserSession
                      ? '0 0 0 1.5px rgba(198,241,53,0.4), 0 4px 20px rgba(198,241,53,0.08)'
                      : 'var(--shadow-card)'

                  return (
                    <button
                      key={template.startTime}
                      className={`time-pill${isSelected ? ' time-pill-selected' : ''}${booked ? ' time-pill-booked' : ''}`}
                      onClick={() => {
                        if (!booked) {
                          setSelectedTime(t => t === template.startTime ? null : template.startTime)
                          setSelectedDuration(60)
                        }
                      }}
                      disabled={booked}
                      style={{
                        padding: '14px 10px',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${pillBorderColor}`,
                        background: pillBg,
                        cursor: booked ? 'not-allowed' : 'pointer',
                        opacity: booked ? 0.4 : 1,
                        pointerEvents: booked ? 'none' : 'auto',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        minHeight: '72px',
                        boxShadow: pillShadow,
                        animationName: 'fadeUp',
                        animationDuration: '0.4s',
                        animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        animationFillMode: 'both',
                        animationDelay: `${idx * 28}ms`,
                      } as React.CSSProperties}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '18px',
                          fontWeight: 700,
                          letterSpacing: '-0.025em',
                          lineHeight: 1,
                          color: isSelected ? 'var(--black)' : booked ? 'var(--text-tertiary)' : 'var(--text)',
                          fontVariantNumeric: 'tabular-nums',
                          textDecoration: booked ? 'line-through' : 'none',
                        }}
                      >
                        {template.startTime}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          lineHeight: 1,
                          color: subtextColor,
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {subtextLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── DURATION — always visible; inert until a start time is picked ── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ marginBottom: '0.6rem' }}>
              <Eyebrow color="secondary">Duration</Eyebrow>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[60, 120].map(mins => {
                const inactive = !selectedTemplate
                const available = !inactive && durationAvailable(mins)
                const isSelectedDuration = !inactive && selectedDuration === mins
                return (
                  <button
                    key={mins}
                    type="button"
                    disabled={inactive || !available}
                    onClick={() => available && setSelectedDuration(mins)}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      borderRadius: 'var(--radius-full)',
                      border: `1px solid ${isSelectedDuration ? 'transparent' : 'var(--border)'}`,
                      background: isSelectedDuration ? 'var(--green)' : 'var(--surface3)',
                      color: inactive || !available ? 'var(--text-tertiary)' : isSelectedDuration ? 'var(--black)' : 'var(--text)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.5,
                      cursor: inactive || !available ? 'not-allowed' : 'pointer',
                      opacity: inactive || !available ? 0.4 : 1,
                      textAlign: 'center',
                    }}
                  >
                    {mins} min
                  </button>
                )
              })}
            </div>
            {!selectedTemplate && (
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                Select a start time first
              </div>
            )}
          </div>

          {/* ── SLOT SUMMARY — appears once a time is selected ── */}
          {selectedTemplate && (
            <div className="slot-detail-panel" style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid',
                  borderColor: selectedTemplate.type === 'peak' ? 'rgba(255,184,0,0.22)' : 'var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Slot header */}
                <div style={{ padding: '20px 20px 16px', borderBottom: userSlotSessionsSelected.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'clamp(20px, 5vw, 26px)',
                          fontWeight: 700,
                          letterSpacing: '-0.025em',
                          lineHeight: 1,
                          color: 'var(--text)',
                          fontVariantNumeric: 'tabular-nums',
                          marginBottom: '8px',
                        }}
                      >
                        {selectedTemplate.startTime}
                        <span style={{ color: 'var(--text-tertiary)', margin: '0 6px', fontWeight: 400, fontSize: '0.72em' }}>to</span>
                        {rangeEndTime}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Badge variant={selectedTemplate.type === 'peak' ? 'peak' : selectedTemplate.type === 'weekend' ? 'weekend' : 'offpeak'}>
                          {typeLabelSelected}
                        </Badge>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {venueName}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '28px',
                          fontWeight: 700,
                          color: 'var(--green)',
                          letterSpacing: '-0.03em',
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        £{perPlayerPriceSelected}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400, marginTop: '4px' }}>per player</div>
                    </div>
                  </div>
                </div>

                {/* User's own sessions */}
                {userSlotSessionsSelected.map((s, i) => {
                  const isOrganiser = !!userId && s.organiser_id === userId
                  const isOpen = s.game_type === 'open'
                  const cap = s.slots.pitches.max_players
                  const count = Math.min(totalCount(s), cap)
                  const icon = isOpen ? '🟢' : '🔒'
                  const nameLabel = s.organiser_name || (isOrganiser ? 'Your team' : 'Game')
                  const subtext = isOpen
                    ? `Public · ${count}/${cap} players`
                    : `Private game · ${count}/${cap} players`
                  const showDivider = i < userSlotSessionsSelected.length - 1
                  return (
                    <div
                      key={s.id}
                      className="dropdown-row"
                      onClick={() => router.push(`/session/${s.id}`)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: showDivider ? '1px solid var(--border-subtle)' : 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '13px', flexShrink: 0 }}>{icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isOrganiser ? 'var(--green)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {nameLabel}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>{subtext}</div>
                        </div>
                      </div>
                      <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginLeft: '12px' }}>
                        <Link href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>View game →</span>
                        </Link>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

                    {/* ── CHOOSE YOUR COURT — only when a venue has more than one pitch ── */}
                    {pitches.length > 1 && (
                      <div style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
                        <div style={{ marginBottom: '0.6rem' }}>
                          <Eyebrow color="secondary">Choose Your Court</Eyebrow>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {pitches.map(pitch => {
                            const active = pitch.id === selectedPitchId
                            return (
                              <button
                                key={pitch.id}
                                type="button"
                                onClick={() => {
                                  if (!active) {
                                    setSelectedPitchId(pitch.id)
                                    setSelectedTime(null)
                                    setSelectedDuration(60)
                                  }
                                }}
                                className={`court-option${active ? ' court-option-active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span className={`court-radio${active ? ' court-radio-active' : ''}`} />
                                  <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)', textTransform: 'uppercase' }}>
                                      {pitch.format}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>
                                      {pitch.surface}
                                    </div>
                                  </div>
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                                  {formatPerPlayer(pitch.offpeak_price, pitch.max_players)}/player
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── PROCEED — always visible; greyed out until a valid, available
                         time + duration (+ court) combination is selected ── */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      {fillingFastSelected && !!createHref && (
                        <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Filling fast
                        </div>
                      )}
                      {(() => {
                        const disabled = !createHref
                        let label = 'Create game'
                        if (!selectedTemplate) label = 'Select a time to continue'
                        else if (bookedSelected) label = 'Game time taken'
                        else if (userSessionIdSelected) label = "You're already in this game"
                        else if (!durationFullyAvailable) label = 'Selected duration unavailable'

                        const button = (
                          <button
                            type="button"
                            disabled={disabled}
                            className="btn-g"
                            style={{
                              width: '100%',
                              padding: '14px 20px',
                              background: disabled ? 'var(--surface3)' : 'var(--green)',
                              color: disabled ? 'var(--text-tertiary)' : 'var(--black)',
                              border: 'none',
                              borderRadius: 'var(--radius-lg)',
                              fontFamily: 'var(--font-display)',
                              fontSize: '15px',
                              fontWeight: 700,
                              letterSpacing: '-0.015em',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              lineHeight: 1,
                              textAlign: 'center',
                            }}
                          >
                            {label}
                          </button>
                        )

                        return createHref ? (
                          <Link href={createHref} style={{ textDecoration: 'none', display: 'block' }}>
                            {button}
                          </Link>
                        ) : button
                      })()}
                    </div>

                    {/* ── TRUST BULLETS ─────────────────────────────── */}
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '1.25rem',
                      }}
                    >
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <CheckIcon /> Secure checkout via Stripe
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <CheckIcon /> Only charged once your game is full
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <CheckIcon /> Refunded automatically if anything goes wrong
                      </li>
                    </ul>

                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </Container>
    </div>
    <Footer />
    </>
  )
}
