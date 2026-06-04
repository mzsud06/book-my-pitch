'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSlotsForDay, SlotTemplate } from '@/lib/slots'

export interface SessionData {
  id: string
  slot_id: string
  status: string
  organiser_name: string | null
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

const LS_KEY = 'bmp_player_details'

interface Props {
  initialSessions: SessionData[]
  dbSlots: DbSlot[]
  venueId: string
  mySlotToSession: Record<string, string>
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function SlotsClient({ initialSessions, dbSlots, venueId, mySlotToSession }: Props) {
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [weekOffset, setWeekOffset] = useState(0)
  const [guestSlotMap, setGuestSlotMap] = useState<Record<string, string>>({})

  // Slot ID map — seeded from server prop, extended client-side for week 2.
  const [slotIdMap, setSlotIdMap] = useState<Map<string, string>>(
    () => new Map(dbSlots.map(s => [`${s.date}_${s.start_time.slice(0, 5)}`, s.id]))
  )

  const today = startOfDay(new Date())
  const allDays = Array.from({ length: 14 }, (_, i) => addDays(today, i))
  const weekDays = allDays.slice(weekOffset * 7, weekOffset * 7 + 7)

  useEffect(() => {
    const channel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, refresh)
      .subscribe()

    function refresh() {
      supabase
        .from('sessions')
        .select('id, slot_id, status, organiser_name, slots!inner(id, date, start_time, end_time, type, price, max_players, venue_id), players(count)')
        .eq('slots.venue_id', venueId)
        .in('status', ['filling', 'confirmed'])
        .then(({ data }) => { if (data) setSessions(data as unknown as SessionData[]) })
    }

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (!stored) return
      const { phone } = JSON.parse(stored) as { phone?: string }
      if (!phone) return

      type PlayerRow = { session_id: string; sessions: { slot_id: string; status: string } | { slot_id: string; status: string }[] | null }
      supabase
        .from('players')
        .select('session_id, sessions(slot_id, status)')
        .eq('phone', phone)
        .then(({ data }) => {
          const map: Record<string, string> = {}
          ;(data as PlayerRow[] | null ?? []).forEach(p => {
            const sess = Array.isArray(p.sessions) ? p.sessions[0] : p.sessions
            if (sess && ['filling', 'confirmed'].includes(sess.status)) {
              map[sess.slot_id] = p.session_id
            }
          })
          setGuestSlotMap(map)
        })
    } catch { /* ignore parse / storage errors */ }
  }, [])

  // When the user navigates to week 2, upsert its slot templates into the DB
  // (in case the server-side upsert missed them) then fetch their IDs so cards
  // become clickable. Week 1 data comes from the server prop; week 2 is lazy.
  useEffect(() => {
    if (weekOffset === 0 || !venueId) return

    const week2Days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), 7 + i))
    const startStr = formatDate(week2Days[0])
    const endStr = formatDate(week2Days[6])

    // Skip if we already have IDs for this range
    const firstKey = `${startStr}_${getSlotsForDay(week2Days[0])[0]?.startTime}`
    if (slotIdMap.has(firstKey)) return

    const inserts = week2Days.flatMap(day =>
      getSlotsForDay(day).map(t => ({
        venue_id: venueId,
        date: formatDate(day),
        start_time: t.startTime,
        end_time: t.endTime,
        type: t.type,
        price: t.priceGBP,
        max_players: t.maxPlayers,
      }))
    )

    supabase
      .from('slots')
      .upsert(inserts, { onConflict: 'venue_id,date,start_time', ignoreDuplicates: true })
      .then(() =>
        supabase
          .from('slots')
          .select('id, date, start_time')
          .eq('venue_id', venueId)
          .gte('date', startStr)
          .lte('date', endStr)
      )
      .then(({ data }) => {
        if (!data?.length) return
        setSlotIdMap(prev => {
          const next = new Map(prev)
          data.forEach(s => next.set(`${s.date}_${s.start_time.slice(0, 5)}`, s.id))
          return next
        })
      })
  }, [weekOffset, venueId])

  const myMap = { ...guestSlotMap, ...mySlotToSession }

  const dayStr = formatDate(selectedDate)
  const slotTemplates = getSlotsForDay(selectedDate)

  const daySessionMap = new Map<string, SessionData[]>()
  sessions.forEach(s => {
    const slot = Array.isArray(s.slots) ? (s.slots as unknown[])[0] as SessionData['slots'] : s.slots
    if (slot?.date === dayStr) {
      const key = slot.start_time.slice(0, 5)
      if (!daySessionMap.has(key)) daySessionMap.set(key, [])
      daySessionMap.get(key)!.push({ ...s, slots: slot })
    }
  })

  function getSlotStatus(template: SlotTemplate) {
    const slotSessions = daySessionMap.get(template.startTime) ?? []
    const slotId = slotIdMap.get(`${dayStr}_${template.startTime}`) ?? null

    const confirmed = slotSessions.find(s => s.status === 'confirmed')
    if (confirmed) {
      return { status: 'booked' as const, hasRival: false, playerCount: 10, sessionId: null, slotId: confirmed.slot_id, isUserSession: false }
    }

    const filling = slotSessions.filter(s => s.status === 'filling')
    if (filling.length === 0) {
      return { status: 'empty' as const, hasRival: false, playerCount: 0, sessionId: null, slotId, isUserSession: false }
    }

    const hasRival = filling.length > 1

    const userSessionId = slotId ? myMap[slotId] : null
    if (userSessionId) {
      const userSess = filling.find(s => s.id === userSessionId) ?? filling[0]
      return { status: 'filling' as const, hasRival, playerCount: totalCount(userSess), sessionId: userSessionId, slotId, isUserSession: true }
    }

    const best = filling.reduce((a, b) => totalCount(a) >= totalCount(b) ? a : b)
    const bestCount = totalCount(best)

    const RIVAL_THRESHOLD = 5
    if (bestCount < RIVAL_THRESHOLD) {
      return { status: 'empty' as const, hasRival: false, playerCount: 0, sessionId: null, slotId, isUserSession: false }
    }

    return { status: 'filling' as const, hasRival, playerCount: 0, sessionId: null, slotId, isUserSession: false }
  }

  function totalCount(s: SessionData): number {
    const organiserCount = s.organiser_name ? 1 : 0
    const playersCount = (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
    return organiserCount + playersCount
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* Venue header */}
      <div className="anim-fade-up" style={{ marginBottom: '0.3rem' }}>
        <h1
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: '30px',
            letterSpacing: '-0.035em',
            lineHeight: 0.95,
            margin: 0,
          }}
        >
          Globe Football Pitch
        </h1>
      </div>
      <div
        className="anim-fade-up d-80"
        style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '2.25rem', fontWeight: 500 }}
      >
        110 Globe Rd, Bethnal Green E1 4DZ · 4G · 5-a-side
      </div>

      {/* ============================================================
          DAY PICKER
          ============================================================ */}
      <div
        className="anim-fade-up d-100"
        style={{ display: 'flex', alignItems: 'stretch', gap: '8px', marginBottom: '1.75rem' }}
      >
        {/* Prev week arrow */}
        <button
          className="week-arrow"
          onClick={() => { setWeekOffset(0); setSelectedDate(startOfDay(new Date())) }}
          disabled={weekOffset === 0}
          aria-label="Previous week"
          style={{
            flexShrink: 0,
            width: '40px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: weekOffset === 0 ? 'rgba(90,90,90,0.25)' : 'var(--muted)',
            fontSize: '18px',
            cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ‹
        </button>

        {/* Day buttons */}
        <div
          style={{
            display: 'flex',
            gap: '5px',
            flex: 1,
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
          }}
        >
          {weekDays.map(day => {
            const active = formatDate(day) === formatDate(selectedDate)
            const isPast = day < startOfDay(new Date())
            return (
              <button
                key={formatDate(day)}
                className={active ? '' : 'day-btn-item'}
                onClick={() => { if (!isPast) setSelectedDate(startOfDay(day)) }}
                disabled={isPast}
                style={{
                  flexShrink: 0,
                  padding: '0.7rem 0.9rem',
                  borderRadius: '10px',
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? 'var(--green)' : 'transparent',
                  color: active ? 'var(--black)' : isPast ? 'rgba(90,90,90,0.28)' : 'var(--muted)',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.18s ease, color 0.18s ease, background 0.18s ease, transform 0.12s ease',
                  textAlign: 'center',
                  minWidth: '54px',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '3px',
                    opacity: active ? 0.7 : 0.65,
                    lineHeight: 1,
                  }}
                >
                  {DAY_NAMES[day.getDay()]}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '20px',
                    fontFamily: "'Archivo Black', sans-serif",
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    marginBottom: '3px',
                  }}
                >
                  {day.getDate()}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    opacity: active ? 0.65 : 0.45,
                    lineHeight: 1,
                  }}
                >
                  {MONTH_NAMES[day.getMonth()]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Next week arrow */}
        <button
          className="week-arrow"
          onClick={() => { setWeekOffset(1); setSelectedDate(startOfDay(allDays[7])) }}
          disabled={weekOffset === 1}
          aria-label="Next week"
          style={{
            flexShrink: 0,
            width: '40px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: weekOffset === 1 ? 'rgba(90,90,90,0.25)' : 'var(--muted)',
            fontSize: '18px',
            cursor: weekOffset === 1 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ›
        </button>
      </div>

      {/* ============================================================
          SLOT LIST
          ============================================================ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {slotTemplates.map((template, idx) => {
          const info = getSlotStatus(template)
          const booked = info.status === 'booked'
          const filling = info.status === 'filling'
          const typeColor = template.type === 'peak' ? '#FF6B6B' : template.type === 'weekend' ? '#00B4FF' : 'var(--green)'
          const typeBg = template.type === 'peak' ? 'rgba(255,68,68,0.14)' : template.type === 'weekend' ? 'rgba(0,180,255,0.1)' : 'rgba(198,241,53,0.1)'
          const perPlayerPitch = (template.priceGBP / 10).toFixed(2)
          const isUserSession = info.isUserSession

          let href: string | undefined
          if (!booked && !isUserSession && info.slotId) {
            href = `/slots/${info.slotId}/create`
          }

          const staggerStyle: React.CSSProperties = {
            animationName: 'fadeUp',
            animationDuration: '0.5s',
            animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            animationFillMode: 'both',
            animationDelay: `${80 + idx * 50}ms`,
          }

          const fillCount = booked ? 10 : filling ? info.playerCount : 0
          const isAmberState = fillCount >= 7 && fillCount < 10
          const segColor = booked ? 'lit-red' : isAmberState ? 'lit-amber' : (filling || isUserSession) ? 'lit-green' : 'lit-green'

          const cardStyle: React.CSSProperties = {
            background: isUserSession
              ? 'linear-gradient(135deg, rgba(198,241,53,0.06) 0%, #0f0f0f 100%)'
              : 'linear-gradient(135deg, #111 0%, #0e0e0e 100%)',
            border: `1px solid ${isUserSession ? 'rgba(198,241,53,0.28)' : booked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '16px',
            padding: '1.3rem 1.5rem',
            cursor: booked ? 'not-allowed' : isUserSession ? 'default' : 'pointer',
            transition: 'transform 0.25s var(--ease-out), border-color 0.25s ease, box-shadow 0.25s var(--ease-out)',
            position: 'relative',
            overflow: 'visible',
            opacity: booked ? 0.36 : 1,
          }

          const cardContent = (
            <>
              {/* Left accent stripe for user's own session */}
              {isUserSession && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '14px',
                    bottom: '14px',
                    width: '3px',
                    background: 'var(--green)',
                    borderRadius: '0 3px 3px 0',
                    boxShadow: '0 0 14px rgba(198,241,53,0.55)',
                  }}
                />
              )}

              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1.1rem',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: '24px',
                      letterSpacing: '-0.04em',
                      color: booked ? 'var(--muted)' : 'var(--text)',
                      lineHeight: 1,
                      marginBottom: '8px',
                    }}
                  >
                    {template.startTime}
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontFamily: "'Archivo', sans-serif",
                        fontWeight: 500,
                        fontSize: '16px',
                        margin: '0 7px',
                      }}
                    >
                      –
                    </span>
                    {template.endTime}
                  </div>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      padding: '3px 9px',
                      borderRadius: '4px',
                      background: typeBg,
                      color: typeColor,
                    }}
                  >
                    {template.type === 'offpeak' ? 'Off-peak' : template.type === 'peak' ? 'Peak' : 'Weekend'}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: '28px',
                      color: booked ? 'var(--muted)' : 'var(--green)',
                      letterSpacing: '-0.04em',
                      lineHeight: 1,
                    }}
                  >
                    £{perPlayerPitch}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>per player</div>
                </div>
              </div>

              {/* Segmented fill bar — 10 discrete blocks */}
              <div className="seg-bar" style={{ marginBottom: '10px' }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const lit = i < fillCount
                  return (
                    <div
                      key={i}
                      className={`seg-bar-seg ${lit ? segColor : 'unlit'}`}
                      style={{ transitionDelay: `${i * 25}ms` }}
                    />
                  )
                })}
              </div>

              {/* Status row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                {booked ? (
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>✕ Slot taken</span>
                ) : filling && isUserSession ? (
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ You&apos;re in this game</span>
                ) : filling ? (
                  <>
                    <span style={{ color: 'var(--amber)', fontWeight: 700 }}>⚡ Another group is racing</span>
                    <span style={{ color: 'var(--green)', fontWeight: 700, letterSpacing: '0.04em' }}>Create game →</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--green)', fontWeight: 700, letterSpacing: '0.04em', marginLeft: 'auto' }}>
                    Create game →
                  </span>
                )}
              </div>
            </>
          )

          return href ? (
            <Link
              key={template.startTime}
              href={href}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block', ...staggerStyle }}
            >
              <div className="slot-pick" style={cardStyle}>
                {cardContent}
              </div>
            </Link>
          ) : (
            <div
              key={template.startTime}
              className={`${booked ? 'taken' : ''} ${isUserSession ? 'user-session' : ''}`}
              style={{ ...cardStyle, ...staggerStyle }}
            >
              {cardContent}
            </div>
          )
        })}
      </div>
    </div>
  )
}
