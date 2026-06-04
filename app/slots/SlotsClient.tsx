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
  /** slot_id → session_id for the logged-in user's active sessions (server-resolved). */
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
  // Guest (not logged-in) users: slot_id → session_id resolved from localStorage phone.
  const [guestSlotMap, setGuestSlotMap] = useState<Record<string, string>>({})

  // Build lookup: "date_startTime" → slotId
  // DB returns time as "HH:MM:SS"; slice to "HH:MM" to match SlotTemplate.startTime
  const slotIdMap = new Map<string, string>(
    dbSlots.map(s => [`${s.date}_${s.start_time.slice(0, 5)}`, s.id])
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

  // For guests: read saved phone from localStorage and look up their sessions.
  // Runs once on mount; mySlotToSession (server prop) takes priority for
  // logged-in users so this only has a visible effect for unauthenticated visitors.
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

  // Merged map: server-side (logged-in) takes priority over localStorage (guest).
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
      // Don't expose the session ID — the booked state never links anywhere
      return { status: 'booked' as const, hasRival: false, playerCount: 10, sessionId: null, slotId: confirmed.slot_id, isUserSession: false }
    }

    const filling = slotSessions.filter(s => s.status === 'filling')
    if (filling.length === 0) {
      return { status: 'empty' as const, hasRival: false, playerCount: 0, sessionId: null, slotId, isUserSession: false }
    }

    const hasRival = filling.length > 1

    // Check if the current user is already in one of the filling sessions.
    const userSessionId = slotId ? myMap[slotId] : null
    if (userSessionId) {
      const userSess = filling.find(s => s.id === userSessionId) ?? filling[0]
      return { status: 'filling' as const, hasRival, playerCount: totalCount(userSess), sessionId: userSessionId, slotId, isUserSession: true }
    }

    const best = filling.reduce((a, b) => totalCount(a) >= totalCount(b) ? a : b)
    const bestCount = totalCount(best)

    // Only surface the rival warning if the leading session has enough momentum.
    // A group with fewer than 5 players is unlikely to fill, so we treat the
    // slot as open and show "Create game →" instead of discouraging new starters.
    const RIVAL_THRESHOLD = 5
    if (bestCount < RIVAL_THRESHOLD) {
      return { status: 'empty' as const, hasRival: false, playerCount: 0, sessionId: null, slotId, isUserSession: false }
    }

    // Never expose rival session details — return no count and no session ID.
    // The only thing the slots page needs to know is that competition exists.
    return { status: 'filling' as const, hasRival, playerCount: 0, sessionId: null, slotId, isUserSession: false }
  }

  function totalCount(s: SessionData): number {
    const organiserCount = s.organiser_name ? 1 : 0
    const playersCount = (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
    return organiserCount + playersCount
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div className="anim-fade-up" style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
        Globe Football Pitch
      </div>
      <div className="anim-fade-up d-80" style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem' }}>
        110 Globe Rd, Bethnal Green E1 4DZ · 4G · 5-a-side · Pick a slot to start filling your team
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
        <button
          className="week-arrow"
          onClick={() => { setWeekOffset(0); setSelectedDate(startOfDay(new Date())) }}
          disabled={weekOffset === 0}
          style={{
            flexShrink: 0, padding: '0.5rem 0.75rem', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'transparent',
            color: weekOffset === 0 ? 'rgba(90,90,90,0.3)' : 'var(--muted)',
            fontFamily: "'Archivo', sans-serif", fontSize: '16px', cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.1s ease',
          }}
        >‹</button>

        <div style={{ display: 'flex', gap: '6px', flex: 1, overflowX: 'auto', paddingBottom: '2px' }}>
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
                  flexShrink: 0, padding: '0.5rem 0.9rem', borderRadius: '8px',
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? 'var(--green)' : 'transparent',
                  color: active ? 'var(--black)' : isPast ? 'rgba(90,90,90,0.4)' : 'var(--muted)',
                  fontFamily: "'Archivo', sans-serif", fontSize: '13px',
                  fontWeight: active ? 700 : 500, cursor: isPast ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.1s ease',
                  textAlign: 'center',
                }}
              >
                <span style={{ display: 'block', fontSize: '13px' }}>{DAY_NAMES[day.getDay()]}</span>
                <span style={{ display: 'block', fontSize: '11px', opacity: 0.7, marginTop: '1px' }}>
                  {day.getDate()} {MONTH_NAMES[day.getMonth()]}
                </span>
              </button>
            )
          })}
        </div>

        <button
          className="week-arrow"
          onClick={() => { setWeekOffset(1); setSelectedDate(startOfDay(allDays[7])) }}
          disabled={weekOffset === 1}
          style={{
            flexShrink: 0, padding: '0.5rem 0.75rem', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'transparent',
            color: weekOffset === 1 ? 'rgba(90,90,90,0.3)' : 'var(--muted)',
            fontFamily: "'Archivo', sans-serif", fontSize: '16px', cursor: weekOffset === 1 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.1s ease',
          }}
        >›</button>
      </div>

      {/* Slot list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {slotTemplates.map((template, idx) => {
          const info = getSlotStatus(template)
          const booked = info.status === 'booked'
          const filling = info.status === 'filling'
          const typeColor = template.type === 'peak' ? '#FF6B6B' : template.type === 'weekend' ? '#00B4FF' : 'var(--green)'
          const typeBg = template.type === 'peak' ? 'rgba(255,68,68,0.15)' : template.type === 'weekend' ? 'rgba(0,180,255,0.12)' : 'rgba(200,244,0,0.12)'
          const perPlayerPitch = (template.priceGBP / 10).toFixed(2)
          const isUserSession = info.isUserSession

          // The slots page never links to an existing session — the only action
          // is "Create game →" which starts the creation flow.  If the user
          // already belongs to a session for this slot the card shows a status
          // indicator but is not clickable (they must use their shared link to
          // return to that session).
          let href: string | undefined
          if (!booked && !isUserSession && info.slotId) {
            href = `/slots/${info.slotId}/create`
          }

          const staggerStyle: React.CSSProperties = {
            animationName: 'fadeUp',
            animationDuration: '0.5s',
            animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            animationFillMode: 'both',
            animationDelay: `${100 + idx * 55}ms`,
          }

          const cardStyle = {
            background: isUserSession
              ? 'linear-gradient(135deg, rgba(200,244,0,0.05) 0%, #0e0e0e 100%)'
              : 'linear-gradient(135deg, #111 0%, #0d0d0d 100%)',
            border: `1px solid ${isUserSession ? 'rgba(200,244,0,0.25)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '14px',
            padding: '1.25rem 1.4rem',
            cursor: booked ? 'not-allowed' : isUserSession ? 'default' : 'pointer',
            transition: 'transform 0.22s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.22s ease, box-shadow 0.22s cubic-bezier(0.23, 1, 0.32, 1)',
            position: 'relative' as const,
            overflow: 'visible' as const,
            opacity: booked ? 0.38 : 1,
          }

          const fillPct = booked ? 100 : filling ? Math.round((info.playerCount / 10) * 100) : 0
          const barColor = booked ? 'var(--red)' : isUserSession ? 'var(--green)' : fillPct >= 70 ? 'var(--amber)' : 'var(--green)'
          const barGlowClass = booked ? 'glow-red' : fillPct >= 70 ? 'glow-amber' : (filling || isUserSession) ? 'glow-green' : ''

          const cardContent = (
            <>
              {/* Lime left accent stripe for user session */}
              {isUserSession && (
                <div style={{
                  position: 'absolute', left: 0, top: '12px', bottom: '12px',
                  width: '3px', background: 'var(--green)',
                  borderRadius: '0 2px 2px 0',
                  boxShadow: '0 0 12px rgba(200,244,0,0.5)',
                }} />
              )}

              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1 }}>
                    {template.startTime}
                    <span style={{ color: 'var(--muted)', fontFamily: "'Archivo', sans-serif", fontWeight: 500, fontSize: '16px', margin: '0 6px' }}>–</span>
                    {template.endTime}
                  </div>
                  <div style={{ marginTop: '7px' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: '4px',
                      background: typeBg, color: typeColor,
                    }}>
                      {template.type === 'offpeak' ? 'Off-peak' : template.type === 'peak' ? 'Peak' : 'Weekend'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', color: '#C8F400', letterSpacing: '-0.5px', lineHeight: 1 }}>
                    £{perPlayerPitch}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>per player</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ background: '#1a1a1a', borderRadius: '100px', height: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                <div
                  className={`slot-bar-fill ${fillPct > 0 || booked ? barGlowClass : ''}`}
                  style={{ background: barColor, width: `${fillPct}%` }}
                />
              </div>

              {/* Status row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                {booked ? (
                  <span style={{ color: 'var(--red)', fontWeight: 700, letterSpacing: '0.02em' }}>✕ Slot taken</span>
                ) : filling && isUserSession ? (
                  <span style={{ color: '#C8F400', fontWeight: 700, letterSpacing: '0.02em' }}>✓ You&apos;re in this game</span>
                ) : filling ? (
                  <>
                    <span style={{ color: 'var(--amber)', fontWeight: 700 }}>⚡ Another group is racing</span>
                    <span style={{ color: '#C8F400', fontWeight: 700, letterSpacing: '0.04em' }}>Create game →</span>
                  </>
                ) : (
                  <span style={{ color: '#C8F400', fontWeight: 700, letterSpacing: '0.04em', marginLeft: 'auto' }}>Create game →</span>
                )}
              </div>
            </>
          )

          return href ? (
            <Link key={template.startTime} href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', ...staggerStyle }}>
              <div className="slot-pick" style={cardStyle}>{cardContent}</div>
            </Link>
          ) : (
            <div key={template.startTime} className={`${booked ? 'taken' : ''} ${isUserSession ? 'user-session' : ''}`} style={{ ...cardStyle, ...staggerStyle }}>{cardContent}</div>
          )
        })}
      </div>
    </div>
  )
}
