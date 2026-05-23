'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Venue {
  id: string
  name: string
  address: string
  stripe_account_id: string | null
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

/** Total players in a session including the organiser (if still set on the session row) */
function totalPlayers(s: SessionData): number {
  const organiserCount = s.organiser_name ? 1 : 0
  return organiserCount + s.players.length
}

const typeLabels: Record<string, string> = {
  offpeak: 'Off-peak',
  peak: 'Peak',
  weekend: 'Weekend',
}

export default function OwnerDashboardClient({ venue, sessions: initialSessions, stats, occupancyData }: Props) {
  const [sessions, setSessions] = useState(initialSessions)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    function fetchSessions() {
      supabase
        .from('sessions')
        .select(`
          id, status, created_at, organiser_name,
          slots!inner(date, start_time, end_time, type, price, venue_id),
          players(id, name, joined_at),
          bookings(id, confirmed_at)
        `)
        .eq('slots.venue_id', venue.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => { if (data) setSessions(data as unknown as SessionData[]) })
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
  const filling = sessions.filter(s => s.status === 'filling')

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Owner nav bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.75rem',
      }}>
        <div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '16px', letterSpacing: '-0.5px', color: 'var(--text)' }}>
              Book<span style={{ color: 'var(--green)' }}>My</span>Pitch<span style={{ color: 'var(--green)' }}>.uk</span>
            </span>
          </Link>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', letterSpacing: '-0.5px', marginTop: '4px' }}>
            Globe Pitch Dashboard
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
            {venue.address}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!venue.stripe_account_id && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', padding: '0.65rem 1rem', fontSize: '13px', color: 'var(--red)' }}>
              ⚠ Stripe Connect not set up — payments won&apos;t process
            </div>
          )}
          <button
            onClick={handleSignOut}
            style={{
              padding: '0.5rem 1rem', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted)', fontFamily: "'Archivo', sans-serif",
              fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.5rem' }} className="stats-grid">
        {[
          { n: String(stats.confirmedThisWeek), l: 'Confirmed this week' },
          { n: `£${stats.revenueThisWeek}`, l: 'Revenue this week' },
          { n: `£${stats.totalRevenue.toLocaleString()}`, l: 'Total revenue' },
          { n: `${stats.fillRate}%`, l: 'Slots filled' },
        ].map(stat => (
          <div key={stat.l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.1rem' }}>
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', color: 'var(--green)', letterSpacing: '-0.5px' }}>{stat.n}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>{stat.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="dash-cols">
        {/* Confirmed bookings */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            Confirmed bookings
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>All paid automatically ✓</span>
          </div>

          {confirmed.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '1rem 0' }}>No confirmed bookings yet</div>
          )}

          {confirmed.slice(0, 8).map(s => (
            <Link key={s.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {s.slots.start_time.slice(0, 5)} {typeLabels[s.slots.type] ?? s.slots.type} · {totalPlayers(s)} players
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {formatDate(s.slots.date)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)', textAlign: 'right' }}>
                    £{s.slots.price}.00
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', textAlign: 'right' }}>Paid ✓</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Slot occupancy */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            Slot occupancy
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>This week</span>
          </div>

          {occupancyData.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '1rem 0' }}>No data for this week</div>
          )}

          {occupancyData.map(occ => (
            <div key={occ.time} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: '90px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{occ.time.slice(0, 5)} {typeLabels[occ.type] ?? ''}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {occ.type === 'weekend' ? 'Weekend' : 'Mon–Fri'}
                </div>
              </div>
              <div style={{ flex: 1, height: '5px', background: 'var(--surface2)', borderRadius: '100px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: '100px',
                  background: 'var(--green)',
                  width: `${occ.total > 0 ? (occ.confirmed / occ.total) * 100 : 0}%`,
                }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: '40px', textAlign: 'right' }}>
                {occ.confirmed}/{occ.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Currently filling */}
      {filling.length > 0 && (
        <div style={{ marginTop: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            Currently filling
            <span style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 400 }}>Live</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filling.map(s => (
              <Link key={s.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--surface2)', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      {s.slots.start_time.slice(0, 5)}–{s.slots.end_time.slice(0, 5)} · {typeLabels[s.slots.type]}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {formatDate(s.slots.date)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--amber)' }}>
                      {totalPlayers(s)}/10
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>players joined</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
