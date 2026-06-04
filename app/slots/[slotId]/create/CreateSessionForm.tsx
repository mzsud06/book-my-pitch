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

interface Props {
  slot: Slot
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '0.7rem 1rem',
  color: 'var(--text)',
  fontFamily: "'Archivo', sans-serif",
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--muted)',
  marginBottom: '6px',
  display: 'block',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}

export default function CreateSessionForm({ slot }: Props) {
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

    sessionStorage.setItem('join_details', JSON.stringify({ name: name.trim(), phone: phone.trim() }))
    router.replace(`/session/${data.sessionId}/join?organiser=1`)
  }

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div
        className="anim-fade-up"
        style={{
          fontSize: '10px',
          color: 'var(--green)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          marginBottom: '0.5rem',
        }}
      >
        Create your game
      </div>
      <div
        className="anim-fade-up d-80"
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: '30px',
          letterSpacing: '-0.035em',
          lineHeight: 0.95,
          marginBottom: '0.3rem',
        }}
      >
        {startTime} – {endTime}
      </div>
      <div
        className="anim-fade-up d-150"
        style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '1.75rem', fontWeight: 500 }}
      >
        {formatDate(slot.date)} · {typeLabel} · {slot.venue?.name ?? 'Globe Football Pitch'}
      </div>

      {/* Slot summary card */}
      <div
        className="anim-fade-up d-200"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.35rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--muted)',
                marginBottom: '3px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {slot.venue?.name ?? 'Globe Football Pitch'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
              {slot.venue?.address ?? '110 Globe Rd, Bethnal Green E1 4DZ'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: '26px',
                color: 'var(--green)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              £{perPlayer}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>per player</div>
          </div>
        </div>

        {/* Team lineup — 2 rows of 5 */}
        <div style={{ marginBottom: '1rem' }}>
          {/* Row 1 */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: '56px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: i === 0 ? 'var(--green)' : 'rgba(255,255,255,0.02)',
                  border: i === 0 ? 'none' : '1px dashed rgba(255,255,255,0.08)',
                  boxShadow: i === 0 ? '0 0 20px rgba(198,241,53,0.25)' : 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '6px',
                    fontSize: '7px',
                    fontWeight: 800,
                    fontFamily: "'Archivo Black', sans-serif",
                    color: i === 0 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.07)',
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: i === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.05)',
                    fontSize: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <div
                  style={{
                    fontSize: '7px',
                    fontWeight: 700,
                    color: i === 0 ? 'var(--black)' : 'rgba(255,255,255,0.12)',
                  }}
                >
                  {i === 0 ? 'You' : `+${i + 1}`}
                </div>
              </div>
            ))}
          </div>

          {/* Center line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <div
              style={{
                fontSize: '7px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.14)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              5-a-side
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Row 2 */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i + 5}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: '56px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '6px',
                    fontSize: '7px',
                    fontWeight: 800,
                    fontFamily: "'Archivo Black', sans-serif",
                    color: 'rgba(255,255,255,0.07)',
                    lineHeight: 1,
                  }}
                >
                  {i + 6}
                </div>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    fontSize: '7px',
                  }}
                />
                <div style={{ fontSize: '7px', fontWeight: 700, color: 'rgba(255,255,255,0.12)' }}>
                  +{i + 6}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Segmented bar — 1/10 lit */}
        <div className="seg-bar" style={{ marginBottom: '8px' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className={`seg-bar-seg ${i === 0 ? 'lit-green' : 'unlit'}`}
              style={{ transitionDelay: `${i * 25}ms` }}
            />
          ))}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', fontWeight: 500 }}>
          <strong style={{ color: 'var(--text)' }}>1/10 players</strong> — 9 more needed to confirm
        </div>
      </div>

      {/* Form */}
      <form
        className="anim-fade-up d-300"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <div>
          <label style={labelStyle}>Your name</label>
          <input
            className="field-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Phone number</label>
          <input
            className="field-input"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            type="tel"
            placeholder="+44 7700 000000"
            required
            style={inputStyle}
          />
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '13px',
              color: 'var(--red)',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim() || !phone.trim()}
          className={!loading && name.trim() && phone.trim() ? 'btn-g' : ''}
          style={{
            width: '100%',
            padding: '0.95rem',
            borderRadius: '10px',
            border: 'none',
            cursor: loading || !name.trim() || !phone.trim() ? 'not-allowed' : 'pointer',
            background:
              loading || !name.trim() || !phone.trim() ? 'var(--surface2)' : 'var(--green)',
            color:
              loading || !name.trim() || !phone.trim() ? 'var(--muted)' : 'var(--black)',
            fontFamily: "'Archivo Black', sans-serif",
            fontWeight: 800,
            fontSize: '15px',
            letterSpacing: '-0.02em',
            marginTop: '4px',
            transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
          }}
        >
          {loading ? 'Creating game…' : 'Create game →'}
        </button>
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
          No payment needed now — only charged when all 10 players join
        </div>
      </form>
    </div>
  )
}
