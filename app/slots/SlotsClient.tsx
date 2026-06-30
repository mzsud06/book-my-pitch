'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSlotsForDay, SlotTemplate } from '@/lib/slots'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { SectionHeading } from '@/components/ui/SectionHeading'

export interface SessionData {
  id: string
  slot_id: string
  organiser_id: string | null
  status: string
  organiser_name: string | null
  team_name: string | null
  is_public: boolean
  game_type: string | null
  matched_session_id: string | null
  slots: {
    id: string
    date: string
    start_time: string
    end_time: string
    type: string
    price: number
    max_players: number
    venue_id: string
  }
  players: { count: number }[]
}

export interface DbSlot {
  id: string
  date: string
  start_time: string
}

interface Props {
  initialSessions: SessionData[]
  dbSlots: DbSlot[]
  venueId: string
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

export default function SlotsClient({ initialSessions, dbSlots, venueId, userSlotSessionMap, userSessionIds, userId }: Props) {
  const userSessionSet = new Set(userSessionIds)
  const router = useRouter()
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const [slotIdMap, setSlotIdMap] = useState<Map<string, string>>(
    () => new Map(dbSlots.map(s => [`${s.date}_${s.start_time.slice(0, 5)}`, s.id]))
  )

  const today = startOfDay(new Date())
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i))

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
        .select('id, slot_id, organiser_id, status, organiser_name, team_name, is_public, game_type, matched_session_id, slots!inner(id, date, start_time, end_time, type, price, max_players, venue_id), players(count)')
        .eq('slots.venue_id', venueId)
        .gte('slots.date', nowStr)
        .lte('slots.date', endStr)
        .in('status', ['filling', 'confirmed'])
        .then(({ data }) => { if (data) setSessions(data as unknown as SessionData[]) })
    }

    return () => { supabase.removeChannel(channel) }
  }, [])

  const dayStr = formatDate(selectedDate)
  const slotTemplates = getSlotsForDay(selectedDate)

  // ── Per-slot session maps ────────────────────────────────────────────────
  const daySessionMap = new Map<string, SessionData[]>()
  sessions.forEach(s => {
    const slot = Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots
    if (slot?.date === dayStr) {
      const key = slot.start_time.slice(0, 5)
      if (!daySessionMap.has(key)) daySessionMap.set(key, [])
      daySessionMap.get(key)!.push({ ...s, slots: slot })
    }
  })

  const challengerCounts = new Map<string, number>()
  sessions.forEach(s => {
    if (s.matched_session_id && s.status === 'filling') {
      challengerCounts.set(s.matched_session_id, (challengerCounts.get(s.matched_session_id) ?? 0) + 1)
    }
  })

  // ── Open games for the selected day ─────────────────────────────────────
  // Source: same `sessions` state (game_type === 'open', filling, no challenge link).
  // No new data fetching — purely derived from existing sessions array.
  type NormalisedSession = Omit<SessionData, 'slots'> & { slots: SessionData['slots'] }
  const dayOpenGames: NormalisedSession[] = sessions
    .filter(s => {
      const slot = Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots
      return (
        slot?.date === dayStr &&
        s.status === 'filling' &&
        !s.matched_session_id &&
        s.game_type === 'open' &&
        !userSessionSet.has(s.id)
      )
    })
    .map(s => ({
      ...s,
      slots: Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots,
    }))
    .sort((a, b) => totalCount(b as SessionData) - totalCount(a as SessionData))

  function getSlotStatus(template: SlotTemplate) {
    const slotSessions = daySessionMap.get(template.startTime) ?? []
    const slotId = slotIdMap.get(`${dayStr}_${template.startTime}`) ?? null

    const confirmed = slotSessions.find(s => s.status === 'confirmed' && totalCount(s) >= 10)
    if (confirmed) {
      return { status: 'booked' as const, hasRival: false, playerCount: 10, sessionId: null, slotId: confirmed.slot_id }
    }

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

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <Container>
        <div style={{ paddingTop: '2.25rem' }}>

          {/* ── VENUE HEADER ─────────────────────────────────── */}
          <div className="anim-fade-up" style={{ marginBottom: '2rem' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-h2)',
                fontWeight: 700,
                letterSpacing: '-0.015em',
                lineHeight: 1.1,
                color: 'var(--text)',
                margin: '0 0 0.6rem',
              }}
            >
              Globe Football Pitch
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 400 }}>
                110 Globe Rd, Bethnal Green E1 4DZ
              </span>
              <Badge variant="neutral">4G</Badge>
              <Badge variant="neutral">5-a-side</Badge>
            </div>
          </div>

          {/* ── DAY SELECTOR ─────────────────────────────────── */}
          <div className="anim-fade-up d-60" style={{ marginBottom: '2rem' }}>
            {/* Row: eyebrow + Available only toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <Eyebrow color="secondary">Select Date</Eyebrow>
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

            {/* 7-day chip row — no arrows */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
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
                        setOpenDropdown(null)
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
          </div>

          {/* ── START TIME ───────────────────────────────────── */}
          <div className="anim-fade-up d-100" style={{ marginBottom: selectedTemplate ? '1.5rem' : '2.5rem' }}>
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
                  const isSelected = selectedTime === template.startTime
                  const isPeak = template.type === 'peak'

                  const slotSessionsForTime = daySessionMap.get(template.startTime) ?? []
                  const userSlotSessions = slotSessionsForTime.filter(s => userSessionSet.has(s.id))
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
                          setOpenDropdown(null)
                        }
                      }}
                      disabled={booked}
                      style={{
                        padding: '14px 10px',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${pillBorderColor}`,
                        background: pillBg,
                        cursor: booked ? 'not-allowed' : 'pointer',
                        opacity: booked ? 0.28 : 1,
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

          {/* ── DETAIL PANEL — slides in when a time is selected ── */}
          {selectedTemplate && selectedInfo && (() => {
            const slotSessionsForTime = daySessionMap.get(selectedTemplate.startTime) ?? []
            const userSlotSessions = slotSessionsForTime.filter(s => userSessionSet.has(s.id))
            const oppositionSessions = slotSessionsForTime.filter(
              s => s.is_public && s.status === 'filling' && !s.matched_session_id &&
                   (s.game_type === 'looking_for_opposition' || s.game_type === null) && !userSessionSet.has(s.id)
            )
            const openSessions = slotSessionsForTime.filter(
              s => s.status === 'filling' && !s.matched_session_id && s.game_type === 'open' && !userSessionSet.has(s.id)
            )
            const allPublicSessions = [...oppositionSessions, ...openSessions]
              .sort((a, b) => totalCount(b) - totalCount(a))

            const userSessionId = userId
              ? userSlotSessions.find(s => s.organiser_id === userId)?.id
              : undefined

            if (userSlotSessions.length > 0) {
              console.log('[SlotsClient] slot', selectedTemplate.startTime, '| userId:', userId, '| sessions:', userSlotSessions.map(s => ({ id: s.id, organiser_id: s.organiser_id })), '| resolved userSessionId:', userSessionId)
            }

            const booked = selectedInfo.status === 'booked'
            const href = !booked && !userSessionId && selectedInfo.slotId
              ? `/slots/${selectedInfo.slotId}/create`
              : undefined
            const fillingFast = !booked && !userSessionId && allPublicSessions.some(s => totalCount(s) >= 7)
            const hasSessions = userSlotSessions.length > 0 || allPublicSessions.length > 0
            const dropOpen = openDropdown === selectedTemplate.startTime
            const typeLabel = selectedTemplate.type === 'peak' ? 'Peak' : selectedTemplate.type === 'offpeak' ? 'Off-peak' : 'Weekend'
            const perPlayerPrice = (selectedTemplate.priceGBP / 10).toFixed(2)

            return (
              <div className="slot-detail-panel" style={{ marginBottom: '2.5rem' }}>

                {/* Duration row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <Eyebrow color="secondary">Duration</Eyebrow>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--surface3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-full)',
                      padding: '4px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.5,
                    }}
                  >
                    60 Minutes
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
                      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M5.5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>

                {/* Slot card */}
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
                  <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
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
                          {selectedTemplate.endTime}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <Badge variant={selectedTemplate.type === 'peak' ? 'peak' : 'offpeak'}>
                            {typeLabel}
                          </Badge>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                            Globe Football Pitch
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
                          £{perPlayerPrice}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400, marginTop: '4px' }}>per player</div>
                      </div>
                    </div>
                  </div>

                  {/* User's own sessions */}
                  {userSlotSessions.map((s, i) => {
                    const isOrganiser = !!userId && s.organiser_id === userId
                    const isLFO = s.game_type === 'looking_for_opposition' || s.game_type === null
                    const isOpen = s.game_type === 'open'
                    const cap = isLFO ? 5 : 10
                    const count = Math.min(totalCount(s), cap)
                    const icon = isLFO ? '⚡' : isOpen ? '🟢' : '🔒'
                    const nameLabel = s.team_name || s.organiser_name || (isOrganiser ? 'Your team' : 'Game')
                    const subtext = isLFO
                      ? `Looking for opposition · ${count}/${cap}`
                      : isOpen
                        ? `Open game · ${count}/${cap} players`
                        : `Private game · ${count}/${cap} players`
                    const showDivider = i < userSlotSessions.length - 1 || allPublicSessions.length > 0 || !!href
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

                  {/* Public sessions toggle */}
                  {allPublicSessions.length > 0 && (
                    <>
                      <div style={{ padding: userSlotSessions.length > 0 ? '6px 12px 8px' : '8px 12px' }}>
                        <button
                          className="games-toggle"
                          onClick={() => setOpenDropdown(o => o === selectedTemplate.startTime ? null : selectedTemplate.startTime)}
                          style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'left', color: 'var(--text)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: 1 }}
                        >
                          <span>See {allPublicSessions.length} other game{allPublicSessions.length !== 1 ? 's' : ''} for this game time</span>
                          <span style={{ fontSize: '11px', opacity: 0.5, flexShrink: 0, marginLeft: '8px' }}>{dropOpen ? '▲' : '▼'}</span>
                        </button>
                      </div>
                      <div style={{ maxHeight: dropOpen ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                        {allPublicSessions.map((s) => {
                          const isLFO = s.game_type === 'looking_for_opposition' || s.game_type === null
                          const cap = isLFO ? 5 : 10
                          const count = Math.min(totalCount(s), cap)
                          const icon = isLFO ? '⚡' : '🟢'
                          const label = s.team_name || s.organiser_name || (isLFO ? 'Team A' : 'Open game')
                          const subtext = isLFO
                            ? `Looking for opposition · ${count}/${cap}`
                            : `Open game · ${count}/${cap} players`
                          const rivals = isLFO ? (challengerCounts.get(s.id) ?? 0) : 0
                          return (
                            <div
                              key={s.id}
                              className="dropdown-row"
                              onClick={() => router.push(`/session/${s.id}`)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: '13px', flexShrink: 0 }}>{icon}</span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>{subtext}</div>
                                  {rivals > 0 && (
                                    <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 500, marginTop: '2px' }}>
                                      {rivals === 1 ? '1 team also challenging' : `${rivals} teams also challenging`}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginLeft: '12px' }}>
                                <Link
                                  href={isLFO && selectedInfo.slotId ? `/slots/${selectedInfo.slotId}/create?challenge=${s.id}` : `/session/${s.id}`}
                                  style={{ textDecoration: 'none' }}
                                >
                                  <button className="dropdown-action-btn" style={{ background: 'var(--green)', color: 'var(--black)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.9rem', fontSize: '12px', fontWeight: 900, fontFamily: 'var(--font-display)', cursor: 'pointer', letterSpacing: '-0.015em', lineHeight: 1, whiteSpace: 'nowrap' }}>
                                    {isLFO ? 'Challenge →' : 'Join →'}
                                  </button>
                                </Link>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Create game CTA */}
                  {href ? (
                    <div style={{ padding: '16px 20px', borderTop: hasSessions ? '1px solid var(--border-subtle)' : 'none' }}>
                      {fillingFast && (
                        <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Filling fast
                        </div>
                      )}
                      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
                        <button
                          className="btn-g"
                          style={{ width: '100%', padding: '14px 20px', background: 'var(--green)', color: 'var(--black)', border: 'none', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.015em', cursor: 'pointer', lineHeight: 1, textAlign: 'center' }}
                        >
                          Create game
                        </button>
                      </Link>
                    </div>
                  ) : booked ? (
                    <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--red)' }}>Game time taken</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })()}

          {/* ── OPEN GAMES ───────────────────────────────────── */}
          {/* Data source: `sessions` state (same fetch as time slots), game_type === 'open',
              filtered to the selected day. No new data fetching. */}
          <div className="anim-fade-up d-150">
            <div style={{ marginBottom: '1.25rem' }}>
              <SectionHeading
                eyebrow="Open Games"
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
                  No open games today — create one above
                </p>
              </div>
            ) : (
              <div className="open-games-scroller">
                {dayOpenGames.map((s, idx) => {
                  const slot = s.slots
                  const playerCount = totalCount(s as SessionData)
                  const maxPlayers = slot.max_players
                  const spotsLeft = Math.max(0, maxPlayers - playerCount)
                  const perPlayer = (slot.price / maxPlayers).toFixed(2)
                  const title = s.team_name || s.organiser_name || 'Open game'
                  const fillPct = Math.min((playerCount / maxPlayers) * 100, 100)
                  const isHot = playerCount >= 7
                  const isPeakSlot = slot.type === 'peak'

                  return (
                    <Link
                      key={s.id}
                      href={`/session/${s.id}`}
                      className="open-game-card-link"
                      style={{ animationName: 'fadeUp', animationDuration: '0.45s', animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)', animationFillMode: 'both', animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="open-game-card">
                        <div
                          style={{
                            position: 'relative',
                            paddingTop: '56.25%',
                            overflow: 'hidden',
                            borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                            background: 'linear-gradient(160deg, var(--pitch-green) 0%, var(--black) 100%)',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'radial-gradient(ellipse 70% 60% at 25% 70%, rgba(198,241,53,0.07) 0%, transparent 100%)',
                              pointerEvents: 'none',
                            }}
                          />
                          <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                            <Badge variant={isPeakSlot ? 'peak' : 'offpeak'}>
                              {slot.start_time.slice(0, 5)}
                            </Badge>
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '12px',
                              left: '12px',
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: '4px',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '20px',
                                fontWeight: 700,
                                color: 'var(--green)',
                                fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-0.025em',
                                lineHeight: 1,
                              }}
                            >
                              £{perPlayer}
                            </span>
                            <span style={{ fontSize: '11px', color: 'rgba(247,244,238,0.55)', fontWeight: 400 }}>
                              /player
                            </span>
                          </div>
                        </div>

                        <div style={{ padding: '14px 16px 16px' }}>
                          <div style={{ marginBottom: '10px' }}>
                            <div
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '16px',
                                fontWeight: 700,
                                letterSpacing: '-0.015em',
                                color: 'var(--text)',
                                lineHeight: 1.25,
                                marginBottom: '3px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {title}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
                              {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
                            </div>
                          </div>

                          <div style={{ marginBottom: '12px' }}>
                            <div
                              style={{
                                height: '4px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '99px',
                                overflow: 'hidden',
                                marginBottom: '6px',
                              }}
                            >
                              <div
                                className={`slot-bar-fill${isHot ? ' glow-amber' : ' glow-green'}`}
                                style={{
                                  width: `${fillPct}%`,
                                  background: isHot ? 'var(--amber)' : 'var(--green)',
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {playerCount}/{maxPlayers} joined · {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                              {isHot && (
                                <span style={{ color: 'var(--amber)', marginLeft: '6px', fontWeight: 600 }}>
                                  · Filling fast
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--green)',
                                color: 'var(--black)',
                                fontFamily: 'var(--font-display)',
                                fontSize: '13px',
                                fontWeight: 700,
                                borderRadius: 'var(--radius-lg)',
                                padding: '8px 16px',
                                letterSpacing: '-0.01em',
                                lineHeight: 1,
                                minHeight: '36px',
                              }}
                            >
                              Join →
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </Container>
    </div>
  )
}
