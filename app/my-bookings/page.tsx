import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

interface PlayerSession {
  id: string
  status: string
  slots: {
    date: string
    start_time: string
    end_time: string
    type: string
    price: number
    venues: { name: string } | null
  }
}

interface PlayerRow {
  id: string
  name: string
  joined_at: string
  sessions: PlayerSession | null
}

export default async function MyBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirect=/my-bookings')

  const { data: rawPlayers } = await supabase
    .from('players')
    .select(`
      id, name, joined_at,
      sessions(
        id, status,
        slots(date, start_time, end_time, type, price,
          venues(name)
        )
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const players = (rawPlayers ?? []) as unknown as PlayerRow[]

  const upcoming = players.filter(p => {
    const s = p.sessions
    if (!s) return false
    const slotDate = new Date(s.slots.date + 'T00:00:00')
    return slotDate >= new Date() && s.status !== 'cancelled'
  })

  const past = players.filter(p => {
    const s = p.sessions
    if (!s) return false
    return new Date(s.slots.date + 'T00:00:00') < new Date()
  })

  return (
    <>
      <Nav />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
          My bookings
        </div>
        <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem' }}>
          Sessions you&apos;ve joined
        </div>

        {players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '1rem' }}>⚽</div>
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '20px', marginBottom: '0.5rem', color: 'var(--text)' }}>
              No bookings yet
            </div>
            <div style={{ fontSize: '15px', marginBottom: '1.5rem' }}>
              Find a slot and join a session to get started.
            </div>
            <Link href="/slots">
              <button style={{
                background: 'var(--green)',
                color: 'var(--black)',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontFamily: "'Archivo', sans-serif",
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                Find a slot →
              </button>
            </Link>
          </div>
        )}

        {upcoming.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '0.75rem' }}>
              Upcoming
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcoming.map(p => {
                const s = p.sessions!
                const isConfirmed = s.status === 'confirmed'
                const perPlayer = (s.slots.price / 10 + 0.50 + 0.30).toFixed(2)
                return (
                  <Link key={p.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--surface)',
                      border: `1px solid ${isConfirmed ? 'rgba(200,244,0,0.2)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      padding: '1rem 1.25rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '16px', letterSpacing: '-0.3px' }}>
                            {s.slots.start_time.slice(0, 5)} – {s.slots.end_time.slice(0, 5)}
                          </div>
                          <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '2px' }}>
                            {s.slots.venues?.name ?? 'Globe Pitch'} · {formatDate(s.slots.date)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: isConfirmed ? 'rgba(200,244,0,0.12)' : 'rgba(255,184,0,0.12)',
                            color: isConfirmed ? 'var(--green)' : 'var(--amber)',
                          }}>
                            {isConfirmed ? 'Confirmed ✓' : 'Filling…'}
                          </div>
                          <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>
                            £{perPlayer} if full
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.75rem' }}>
              Past
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.6 }}>
              {past.map(p => {
                const s = p.sessions!
                return (
                  <Link key={p.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.85rem 1.25rem', cursor: 'pointer' }}>
                      <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '15px', letterSpacing: '-0.3px' }}>
                        {s.slots.start_time.slice(0, 5)} – {s.slots.end_time.slice(0, 5)}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                        {s.slots.venues?.name ?? 'Globe Pitch'} · {formatDate(s.slots.date)} · {s.status === 'confirmed' ? 'Played' : 'Not filled'}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
