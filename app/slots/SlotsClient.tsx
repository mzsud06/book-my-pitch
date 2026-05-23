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

interface Props {
  initialSessions: SessionData[]
  dbSlots: DbSlot[]
  venueId: string
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

export default function SlotsClient({ initialSessions, dbSlots, venueId }: Props) {
  const supabase = createClient()
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [weekOffset, setWeekOffset] = useState(0)

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
    const confirmed = slotSessions.find(s => s.status === 'confirmed')
    if (confirmed) {
      return { status: 'booked' as const, hasRival: false, playerCount: 10, sessionId: confirmed.id, slotId: confirmed.slot_id }
    }

    const slotId = slotIdMap.get(`${dayStr}_${template.startTime}`) ?? null

    const filling = slotSessions.filter(s => s.status === 'filling')
    if (filling.length === 0) {
      return { status: 'empty' as const, hasRival: false, playerCount: 0, sessionId: null, slotId }
    }

    const hasRival = filling.length > 1
    const best = filling.reduce((a, b) => {
      const ac = totalCount(a)
      const bc = totalCount(b)
      return ac >= bc ? a : b
    })
    const playerCount = hasRival ? 0 : totalCount(best)

    return { status: 'filling' as const, hasRival, playerCount, sessionId: best.id, slotId: best.slot_id }
  }

  function totalCount(s: SessionData): number {
    const organiserCount = s.organiser_name ? 1 : 0
    const playersCount = (Array.isArray(s.players) ? s.players[0]?.count : 0) ?? 0
    return organiserCount + playersCount
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <style>{`
        .slot-pick:hover:not(.taken) { border-color: rgba(200,244,0,0.25) !important; transform: translateY(-1px); }
        .day-btn-item:hover { border-color: rgba(255,255,255,0.18) !important; color: var(--text) !important; }
        .week-arrow:hover { border-color: rgba(255,255,255,0.18) !important; color: var(--text) !important; }
      `}</style>

      <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
        Globe Football Pitch
      </div>
      <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem' }}>
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
            transition: 'all 0.15s',
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
                  transition: 'all 0.15s', textAlign: 'center',
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
            transition: 'all 0.15s',
          }}
        >›</button>
      </div>

      {/* Slot list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {slotTemplates.map(template => {
          const info = getSlotStatus(template)
          const booked = info.status === 'booked'
          const filling = info.status === 'filling'
          const typeColor = template.type === 'peak' ? '#FF6B6B' : template.type === 'weekend' ? '#00B4FF' : 'var(--green)'
          const typeBg = template.type === 'peak' ? 'rgba(255,68,68,0.15)' : template.type === 'weekend' ? 'rgba(0,180,255,0.12)' : 'rgba(200,244,0,0.12)'
          const perPlayerPitch = (template.priceGBP / 10).toFixed(2)

          let href: string | undefined
          if (!booked) {
            if (filling && info.sessionId) {
              href = `/session/${info.sessionId}`
            } else if (info.slotId) {
              href = `/slots/${info.slotId}/create`
            }
          }

          const cardStyle = {
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
            cursor: booked ? 'not-allowed' : 'pointer',
            transition: 'all 0.18s',
            position: 'relative' as const,
            overflow: 'hidden' as const,
            opacity: booked ? 0.45 : 1,
            borderLeft: `3px solid ${typeColor}`,
          }

          const fillPct = booked ? 100 : filling ? Math.round((info.playerCount / 10) * 100) : 0
          const barColor = booked ? 'var(--red)' : fillPct >= 70 ? 'var(--amber)' : 'var(--green)'

          const cardContent = (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: '4px', marginBottom: '6px', display: 'inline-block',
                    background: typeBg, color: typeColor,
                  }}>
                    {template.type === 'offpeak' ? 'Off-peak' : template.type === 'peak' ? 'Peak' : 'Weekend'}
                  </div>
                  <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '18px', letterSpacing: '-0.3px', marginTop: '4px' }}>
                    {template.startTime} – {template.endTime}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '20px', color: 'var(--green)', letterSpacing: '-0.5px' }}>
                    £{perPlayerPitch}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px', textAlign: 'right' }}>per player</div>
                </div>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: '100px', height: '5px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ height: '100%', borderRadius: '100px', background: barColor, width: `${fillPct}%`, transition: 'width 0.3s' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                {booked ? (
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>Booked — slot taken</span>
                ) : filling ? (
                  <>
                    <span style={{ color: 'var(--muted)' }}>
                      {info.hasRival ? 'Multiple groups filling' : `${info.playerCount}/10 players`}
                    </span>
                    {info.hasRival && <span style={{ color: 'var(--amber)', fontWeight: 700 }}>⚡ Race to fill</span>}
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 700, color: 'var(--muted)' }}>0/10 · be the first</span>
                    <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '12px' }}>Create game →</span>
                  </>
                )}
              </div>
            </>
          )

          return href ? (
            <Link key={template.startTime} href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div className="slot-pick" style={cardStyle}>{cardContent}</div>
            </Link>
          ) : (
            <div key={template.startTime} className="taken" style={cardStyle}>{cardContent}</div>
          )
        })}
      </div>
    </div>
  )
}
