'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSlotsForDay, SlotTemplate } from '@/lib/slots'

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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function SlotsClient({ initialSessions, dbSlots, venueId, userSlotSessionMap, userSessionIds, userId }: Props) {
  const userSessionSet = new Set(userSessionIds)
  const router = useRouter()
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [weekOffset, setWeekOffset] = useState(0)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const [slotIdMap, setSlotIdMap] = useState<Map<string, string>>(
    () => new Map(dbSlots.map(s => [`${s.date}_${s.start_time.slice(0, 5)}`, s.id]))
  )

  const today = startOfDay(new Date())
  const todayDateStr = formatDate(today)
  const allDays = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    .filter(d => formatDate(d) >= todayDateStr)
  const weekDays = allDays.slice(weekOffset * 7, weekOffset * 7 + 7)

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

  useEffect(() => {
    if (weekOffset === 0 || !venueId) return

    const week2Days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), 7 + i))
    const startStr = formatDate(week2Days[0])
    const endStr = formatDate(week2Days[6])

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

  // Count active challengers per LFO session (sessions pointing at an LFO via matched_session_id)
  const challengerCounts = new Map<string, number>()
  sessions.forEach(s => {
    if (s.matched_session_id && s.status === 'filling') {
      challengerCounts.set(s.matched_session_id, (challengerCounts.get(s.matched_session_id) ?? 0) + 1)
    }
  })

  function getSlotStatus(template: SlotTemplate) {
    const slotSessions = daySessionMap.get(template.startTime) ?? []
    const slotId = slotIdMap.get(`${dayStr}_${template.startTime}`) ?? null

    // Only truly unavailable when confirmed with a full 10-player game
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

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

      {/* Venue header */}
      <div className="anim-fade-up" style={{ marginBottom: '0.4rem' }}>
        <h1
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 'clamp(26px, 5vw, 36px)',
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            margin: 0,
          }}
        >
          Globe Football Pitch
        </h1>
      </div>
      <div
        className="anim-fade-up d-80"
        style={{
          fontSize: '13px',
          color: 'var(--muted)',
          marginBottom: '2.5rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>110 Globe Rd, Bethnal Green E1 4DZ</span>
        <span style={{ color: 'var(--border)', fontWeight: 400 }}>·</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(198,241,53,0.08)',
            border: '1px solid rgba(198,241,53,0.15)',
            borderRadius: '5px',
            padding: '1px 7px',
            fontSize: '10px',
            color: 'var(--green)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          4G
        </span>
        <span style={{ color: 'var(--border)', fontWeight: 400 }}>·</span>
        <span>5-a-side</span>
      </div>

      {/* ============================================================
          DAY PICKER
          ============================================================ */}
      <div
        className="anim-fade-up d-100"
        style={{ display: 'flex', alignItems: 'stretch', gap: '8px', marginBottom: '2rem' }}
      >
        {/* Prev week arrow */}
        <button
          className="week-arrow"
          onClick={() => { setWeekOffset(0); setSelectedDate(startOfDay(new Date())) }}
          disabled={weekOffset === 0}
          aria-label="Previous week"
          style={{
            flexShrink: 0,
            width: '42px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: weekOffset === 0 ? 'rgba(104,104,104,0.22)' : 'var(--muted)',
            fontSize: '20px',
            cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
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
                  flex: 1,
                  minWidth: '52px',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '12px',
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? 'var(--green)' : 'transparent',
                  color: active ? 'var(--black)' : isPast ? 'rgba(104,104,104,0.22)' : 'var(--muted)',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.18s ease, color 0.18s ease, background 0.18s ease, transform 0.12s ease',
                  textAlign: 'center',
                  lineHeight: 1,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '4px',
                    opacity: active ? 0.65 : 0.6,
                  }}
                >
                  {DAY_NAMES[day.getDay()]}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '21px',
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
                    fontSize: '8px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    opacity: active ? 0.6 : 0.4,
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
            width: '42px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: weekOffset === 1 ? 'rgba(104,104,104,0.22)' : 'var(--muted)',
            fontSize: '20px',
            cursor: weekOffset === 1 ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>

      {/* ============================================================
          SLOT LIST
          ============================================================ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {slotTemplates.map((template, idx) => {
          const info = getSlotStatus(template)
          const booked = info.status === 'booked'
          const typeColor = template.type === 'peak' ? '#FF6B6B' : template.type === 'weekend' ? '#00B4FF' : 'var(--green)'
          const typeBg = template.type === 'peak' ? 'rgba(255,68,68,0.12)' : template.type === 'weekend' ? 'rgba(0,180,255,0.09)' : 'rgba(198,241,53,0.09)'
          const perPlayerPitch = (template.priceGBP / 10).toFixed(2)

          const slotSessionsForTime = daySessionMap.get(template.startTime) ?? []
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

          // Identify the current user's organiser session for this slot (if any) directly
          // from organiser_id — more reliable than the slotIdMap lookup.
          const userSessionId = userId
            ? userSlotSessions.find(s => s.organiser_id === userId)?.id
            : undefined
          if (userSlotSessions.length > 0) {
            console.log('[SlotsClient] slot', template.startTime, '| userId:', userId, '| sessions:', userSlotSessions.map(s => ({ id: s.id, organiser_id: s.organiser_id })), '| resolved userSessionId:', userSessionId)
          }
          // Card navigates to create unless booked or the current user is organiser of this slot
          const href = !booked && !userSessionId && info.slotId ? `/slots/${info.slotId}/create` : undefined

          const hasBelow = !booked && (userSlotSessions.length > 0 || allPublicSessions.length > 0)
          const fillingFast = !booked && !userSessionId && allPublicSessions.some(s => totalCount(s) >= 7)
          const dropOpen = openDropdown === template.startTime

          const staggerStyle: React.CSSProperties = {
            animationName: 'fadeUp',
            animationDuration: '0.5s',
            animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            animationFillMode: 'both',
            animationDelay: `${80 + idx * 50}ms`,
          }

          const borderColor = booked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'

          const cardStyle: React.CSSProperties = {
            background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
            border: `1px solid ${borderColor}`,
            borderRadius: hasBelow ? '18px 18px 0 0' : '18px',
            padding: '1.4rem 1.6rem',
            cursor: booked ? 'not-allowed' : userSessionId ? 'default' : 'pointer',
            transition: 'transform 0.25s var(--ease-out), border-color 0.25s ease, box-shadow 0.25s var(--ease-out)',
            position: 'relative',
            overflow: 'hidden',
            opacity: booked ? 0.32 : 1,
            boxShadow: userSessionId
              ? '0 0 0 1.5px rgba(198,241,53,0.4), 0 4px 20px rgba(198,241,53,0.08)'
              : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
          }

          const cardContent = (
            <>
              {userSessionId && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(198,241,53,0.18)',
                    border: '1.5px solid rgba(198,241,53,0.6)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#C6F135',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#C6F135',
                      color: '#000',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      fontWeight: 900,
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                  Your game
                </div>
              )}
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1.1rem',
                  ...(userSessionId ? { paddingTop: '1.75rem' } : {}),
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: '26px',
                      letterSpacing: '-0.04em',
                      color: booked ? 'var(--muted)' : 'var(--text)',
                      lineHeight: 1,
                      marginBottom: '9px',
                    }}
                  >
                    {template.startTime}
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontFamily: "'Archivo', sans-serif",
                        fontWeight: 400,
                        fontSize: '16px',
                        margin: '0 8px',
                        opacity: 0.6,
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
                      borderRadius: '5px',
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
                      fontSize: '30px',
                      color: booked ? 'var(--muted)' : 'var(--green)',
                      letterSpacing: '-0.04em',
                      lineHeight: 1,
                    }}
                  >
                    £{perPlayerPitch}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '5px', fontWeight: 500 }}>per player</div>
                </div>
              </div>

              {/* Status row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {booked ? (
                  <span style={{ color: 'var(--red)', letterSpacing: '0.02em' }}>Slot taken</span>
                ) : userSessionId ? null : (
                  <>
                    {fillingFast && (
                      <span style={{ color: 'var(--amber)', fontWeight: 500, fontSize: '11px' }}>Filling fast</span>
                    )}
                    {info.slotId && (
                      <span style={{ color: 'var(--green)', letterSpacing: '0.02em', marginLeft: 'auto' }}>Create game →</span>
                    )}
                  </>
                )}
              </div>
            </>
          )

          return (
            <div key={template.startTime} style={staggerStyle}>
              {href ? (
                <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div className="slot-pick" style={cardStyle}>
                    {cardContent}
                  </div>
                </Link>
              ) : (
                <div className={booked ? 'taken' : userSessionId ? 'user-session' : ''} style={cardStyle}>
                  {cardContent}
                </div>
              )}

              {/* Unified below-card section */}
              {hasBelow && (
                <div
                  style={{
                    borderLeft: '3px solid rgba(198,241,53,0.4)',
                    background: '#111111',
                    borderRadius: '0 0 14px 14px',
                    overflow: 'hidden',
                  }}
                >
                  {/* User's own sessions — always visible */}
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
                    const showDivider = i < userSlotSessions.length - 1 || allPublicSessions.length > 0
                    return (
                      <div
                        key={s.id}
                        className="dropdown-row"
                        onClick={() => router.push(`/session/${s.id}`)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: showDivider ? '1px solid #1a1a1a' : 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '13px', flexShrink: 0 }}>{icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isOrganiser ? '#C6F135' : 'var(--text)' }}>{nameLabel}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', fontWeight: 500 }}>{subtext}</div>
                          </div>
                        </div>
                        <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginLeft: '12px' }}>
                          <Link href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#C6F135', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>→ View game</span>
                          </Link>
                        </span>
                      </div>
                    )
                  })}

                  {/* Other public sessions — subtle toggle */}
                  {allPublicSessions.length > 0 && (
                    <>
                      <div style={{ padding: userSlotSessions.length > 0 ? '6px 8px 8px' : '8px 8px 8px' }}>
                        <button
                          className="games-toggle"
                          onClick={() => setOpenDropdown(o => o === template.startTime ? null : template.startTime)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            textAlign: 'left',
                            color: 'var(--text)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: "'Archivo', sans-serif",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            lineHeight: 1,
                          }}
                        >
                          <span>See {allPublicSessions.length} other game{allPublicSessions.length !== 1 ? 's' : ''} for this slot</span>
                          <span style={{ fontSize: '11px', opacity: 0.5, flexShrink: 0, marginLeft: '8px' }}>{dropOpen ? '▲' : '▼'}</span>
                        </button>
                      </div>

                      <div style={{ maxHeight: dropOpen ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                        {allPublicSessions.map((s, i) => {
                          const isLast = i === allPublicSessions.length - 1
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
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid #1a1a1a', borderBottom: isLast ? 'none' : 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: '13px', flexShrink: 0 }}>{icon}</span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', fontWeight: 500 }}>{subtext}</div>
                                  {rivals > 0 && (
                                    <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 500, marginTop: '2px' }}>
                                      {rivals === 1 ? '1 team also challenging' : `${rivals} teams also challenging`}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginLeft: '12px' }}>
                                <Link
                                  href={isLFO && info.slotId ? `/slots/${info.slotId}/create?challenge=${s.id}` : `/session/${s.id}`}
                                  style={{ textDecoration: 'none' }}
                                >
                                  <button className="dropdown-action-btn" style={{ background: '#C6F135', color: '#000', border: 'none', borderRadius: '8px', padding: '0.5rem 0.9rem', fontSize: '12px', fontWeight: 900, fontFamily: "'Archivo Black', sans-serif", cursor: 'pointer', letterSpacing: '-0.015em', lineHeight: 1, whiteSpace: 'nowrap' }}>
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
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
