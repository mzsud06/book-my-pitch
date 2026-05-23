'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Slot {
  id: string
  date: string
  start_time: string
  end_time: string
  type: string
  price: number
  max_players: number
  venue: { name: string; address: string } | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)',
  fontFamily: "'Archivo', sans-serif", fontSize: '14px', outline: 'none',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', display: 'block',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
}

export default function CreateSessionForm({ slot }: { slot: Slot }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const perPlayer = (slot.price / 10).toFixed(2)
  const typeLabel = slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'
  const startTime = slot.start_time.slice(0, 5)
  const endTime = slot.end_time.slice(0, 5)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id, name: name.trim(), phone: phone.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to create session')
      setLoading(false)
      return
    }

    // Save name/phone so the join form can auto-fill them
    sessionStorage.setItem('join_details', JSON.stringify({ name: name.trim(), phone: phone.trim() }))

    // Redirect organiser through the payment flow so they are charged like everyone else
    router.push(`/session/${data.sessionId}/join?organiser=1`)
  }

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
        Create your game
      </div>
      <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '28px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
        {startTime} – {endTime}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1.75rem' }}>
        {formatDate(slot.date)} · {typeLabel} · {slot.venue?.name ?? 'Globe Football Pitch'}
      </div>

      {/* Slot summary card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>
              {slot.venue?.name ?? 'Globe Football Pitch'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {slot.venue?.address ?? '110 Globe Rd, Bethnal Green E1 4DZ'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', color: 'var(--green)', letterSpacing: '-0.5px' }}>
              £{perPlayer}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>per player</div>
          </div>
        </div>

        {/* Empty player grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '0.75rem' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{
              height: '36px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: i === 0 ? '11px' : '11px', fontWeight: 700,
              background: i === 0 ? 'var(--green)' : 'var(--surface2)',
              border: i === 0 ? 'none' : '1px dashed rgba(255,255,255,0.07)',
              color: i === 0 ? 'var(--black)' : 'var(--muted)',
            }}>
              {i === 0 ? 'You' : '+1'}
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface2)', borderRadius: '100px', height: '6px', overflow: 'hidden', marginBottom: '6px' }}>
          <div style={{ height: '100%', borderRadius: '100px', background: 'var(--green)', width: '10%', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
          <strong style={{ color: 'var(--text)' }}>1/10 players</strong> — 9 more needed to confirm
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={labelStyle}>Your name</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Full name" required style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <div>
          <label style={labelStyle}>Phone number</label>
          <input
            value={phone} onChange={e => setPhone(e.target.value)}
            type="tel" placeholder="+44 7700 000000" required style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {error && (
          <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim() || !phone.trim()}
          style={{
            width: '100%', padding: '0.9rem', borderRadius: '10px', border: 'none',
            cursor: loading || !name.trim() || !phone.trim() ? 'not-allowed' : 'pointer',
            background: loading || !name.trim() || !phone.trim() ? 'var(--surface2)' : 'var(--green)',
            color: loading || !name.trim() || !phone.trim() ? 'var(--muted)' : 'var(--black)',
            fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '16px', marginTop: '4px',
          }}
        >
          {loading ? 'Creating game…' : 'Create game →'}
        </button>
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
          No payment needed now — only charged when all 10 players join
        </div>
      </form>
    </div>
  )
}
