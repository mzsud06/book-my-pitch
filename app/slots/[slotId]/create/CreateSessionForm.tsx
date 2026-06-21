'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const COUNTRY_CODES = [
  { code: '+44',  label: '🇬🇧 +44' },
  { code: '+1',   label: '🇺🇸 +1' },
  { code: '+92',  label: '🇵🇰 +92' },
  { code: '+880', label: '🇧🇩 +880' },
  { code: '+91',  label: '🇮🇳 +91' },
  { code: '+234', label: '🇳🇬 +234' },
  { code: '+249', label: '🇸🇴 +249' },
  { code: '+212', label: '🇲🇦 +212' },
  { code: '+213', label: '🇩🇿 +213' },
  { code: '+90',  label: '🇹🇷 +90' },
]

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
  borderRadius: '10px',
  padding: '0.8rem 1rem',
  color: 'var(--text)',
  fontFamily: "'Archivo', sans-serif",
  fontSize: '15px',
  fontWeight: 600,
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--muted)',
  marginBottom: '7px',
  display: 'block',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
}

export default function CreateSessionForm({ slot }: Props) {
  const router = useRouter()
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+44')
  const [localNumber, setLocalNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [teamName, setTeamName] = useState('')
  const [gameType, setGameType] = useState<'private' | 'looking_for_opposition' | 'open'>('private')

  const searchParams = useSearchParams()
  const challengeSessionId = searchParams.get('challenge')
  const [challengedTeamName, setChallengedTeamName] = useState<string | null>(null)
  const [challengedPlayerCount, setChallengedPlayerCount] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function checkExisting() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }

      // Check as organiser
      const { data: asOrganiser } = await supabase
        .from('sessions')
        .select('id')
        .eq('slot_id', slot.id)
        .eq('organiser_id', user.id)
        .in('status', ['filling', 'confirmed'])
        .maybeSingle()

      if (asOrganiser) {
        setExistingSessionId(asOrganiser.id)
        setChecking(false)
        return
      }

      // Check as player in any active session for this slot
      const { data: activeForSlot } = await supabase
        .from('sessions')
        .select('id')
        .eq('slot_id', slot.id)
        .in('status', ['filling', 'confirmed'])

      if (activeForSlot && activeForSlot.length > 0) {
        const { data: asPlayer } = await supabase
          .from('players')
          .select('session_id')
          .eq('user_id', user.id)
          .in('session_id', activeForSlot.map(s => s.id))
          .maybeSingle()

        if (asPlayer) {
          setExistingSessionId((asPlayer as { session_id: string }).session_id)
          setChecking(false)
          return
        }
      }

      setChecking(false)
    }
    checkExisting()
  }, [slot.id])

  useEffect(() => {
    if (!challengeSessionId) return
    const supabase = createClient()
    supabase
      .from('sessions')
      .select('id, team_name, players(count)')
      .eq('id', challengeSessionId)
      .single()
      .then(({ data }) => {
        if (!data) return
        setChallengedTeamName((data as unknown as { team_name: string | null }).team_name)
        const players = (data as unknown as { players: { count: number }[] }).players
        setChallengedPlayerCount(players?.[0]?.count ?? 0)
      })
  }, [challengeSessionId])

  const perPlayer = (slot.price / 10).toFixed(2)
  const typeLabel = slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'
  const typeColor = slot.type === 'peak' ? '#FF6B6B' : slot.type === 'weekend' ? '#00B4FF' : 'var(--green)'
  const typeBg = slot.type === 'peak' ? 'rgba(255,68,68,0.12)' : slot.type === 'weekend' ? 'rgba(0,180,255,0.09)' : 'rgba(198,241,53,0.09)'
  const startTime = slot.start_time.slice(0, 5)
  const endTime = slot.end_time.slice(0, 5)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let valid = true
    if (!name.trim() || !/^[A-Za-z ]+$/.test(name.trim())) {
      setNameError('Name may only contain letters and spaces')
      valid = false
    }
    if (!localNumber.trim() || !/^[0-9]+$/.test(localNumber.trim())) {
      setPhoneError('Please enter a valid phone number')
      valid = false
    }
    if (!valid) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id, name: name.trim(), phone: phone.trim(), teamName: gameType === 'looking_for_opposition' ? teamName.trim() : '', gameType, ...(challengeSessionId ? { matchedSessionId: challengeSessionId } : {}) }),
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

  const isReady = name.trim() && localNumber.trim()

  if (checking) return null

  if (existingSessionId) return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      <div
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: 'clamp(22px, 4vw, 30px)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginBottom: '1rem',
        }}
      >
        You already have a game for this slot.
      </div>
      <Link href={`/session/${existingSessionId}`} style={{ textDecoration: 'none' }}>
        <button
          style={{
            padding: '0.9rem 2rem',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--green)',
            color: 'var(--black)',
            fontFamily: "'Archivo Black', sans-serif",
            fontWeight: 900,
            fontSize: '15px',
            letterSpacing: '-0.025em',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          View your game →
        </button>
      </Link>
    </div>
  )

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

      {/* Page header */}
      <div
        className="anim-fade-up"
        style={{
          fontSize: '10px',
          color: 'var(--green)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          marginBottom: '0.6rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            width: '20px',
            height: '2px',
            background: 'var(--green)',
            display: 'block',
            borderRadius: '2px',
            flexShrink: 0,
          }}
        />
        {challengeSessionId ? 'Join the challenge' : 'Create your game'}
      </div>
      <div
        className="anim-fade-up d-80"
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: 'clamp(28px, 5vw, 38px)',
          letterSpacing: '-0.04em',
          lineHeight: 0.9,
          marginBottom: '0.4rem',
        }}
      >
        {startTime} – {endTime}
      </div>
      <div
        className="anim-fade-up d-150"
        style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '2rem', fontWeight: 500 }}
      >
        {formatDate(slot.date)} · {typeLabel} · {slot.venue?.name ?? 'Globe Football Pitch'}
      </div>

      {challengeSessionId && (
        <div
          className="anim-fade-up d-180"
          style={{
            background: '#C6F135',
            borderRadius: '12px',
            padding: '1rem 1.1rem',
            color: '#000',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '15px',
              letterSpacing: '-0.025em',
              lineHeight: 1.3,
              marginBottom: '5px',
            }}
          >
            ⚡ You&apos;re challenging {challengedTeamName || 'Team A'} — fill your team of 5 to lock in the match.
          </div>
          {challengedPlayerCount !== null && (
            <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.65 }}>
              They currently have {challengedPlayerCount}/5 players.
            </div>
          )}
        </div>
      )}

      {/* Slot summary card */}
      <div
        className="anim-fade-up d-200"
        style={{
          background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '18px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--muted)',
                marginBottom: '4px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {slot.venue?.name ?? 'Globe Football Pitch'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
              {slot.venue?.address ?? '110 Globe Rd, Bethnal Green E1 4DZ'}
            </div>
            <div style={{ marginTop: '10px' }}>
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
                {typeLabel}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: '30px',
                color: 'var(--green)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              £{perPlayer}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500 }}>per player</div>
          </div>
        </div>

        {/* Team lineup — 2 rows of 5 */}
        <div style={{ marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: '58px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: i === 0 ? 'var(--green)' : 'rgba(255,255,255,0.02)',
                  border: i === 0 ? 'none' : '1px dashed rgba(255,255,255,0.07)',
                  boxShadow: i === 0 ? '0 0 24px rgba(198,241,53,0.22)' : 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '6px',
                    fontSize: '7px',
                    fontWeight: 900,
                    fontFamily: "'Archivo Black', sans-serif",
                    color: i === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.06)',
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: i === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.04)',
                  }}
                />
                <div
                  style={{
                    fontSize: '7px',
                    fontWeight: 700,
                    color: i === 0 ? 'var(--black)' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {i === 0 ? 'You' : `+${i + 1}`}
                </div>
              </div>
            ))}
          </div>

          {!challengeSessionId && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                <div
                  style={{
                    fontSize: '7px',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.12)',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  5-a-side
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              </div>

              <div style={{ display: 'flex', gap: '5px' }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i + 5}
                    style={{
                      position: 'relative',
                      flex: 1,
                      height: '58px',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px dashed rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '6px',
                        fontSize: '7px',
                        fontWeight: 900,
                        fontFamily: "'Archivo Black', sans-serif",
                        color: 'rgba(255,255,255,0.06)',
                        lineHeight: 1,
                      }}
                    >
                      {i + 6}
                    </div>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    />
                    <div style={{ fontSize: '7px', fontWeight: 700, color: 'rgba(255,255,255,0.1)' }}>
                      +{i + 6}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Segmented bar */}
        <div className="seg-bar" style={{ marginBottom: '10px' }}>
          {Array.from({ length: challengeSessionId ? 5 : 10 }, (_, i) => (
            <div
              key={i}
              className={`seg-bar-seg ${i === 0 ? 'lit-green' : 'unlit'}`}
              style={{ transitionDelay: `${i * 25}ms` }}
            />
          ))}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', fontWeight: 500 }}>
          {challengeSessionId ? (
            <>
              <strong style={{ color: 'var(--text)', fontWeight: 800 }}>1/5 players</strong>
              {' '}— 4 more needed to lock in the match
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text)', fontWeight: 800 }}>1/10 players</strong>
              {' '}— 9 more needed to confirm
            </>
          )}
        </div>
      </div>

      {/* Form */}
      <form
        className="anim-fade-up d-300"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        <div>
          <label style={labelStyle}>Your name</label>
          <input
            className="field-input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^a-zA-Z\s]/g, '')
              setName(cleaned)
            }}
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey) return
              if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
              if (!/^[a-zA-Z\s]$/.test(e.key)) e.preventDefault()
            }}
            placeholder="Full name"
            required
            style={inputStyle}
          />
          {nameError && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{nameError}</div>}
        </div>
        <div>
          <label style={labelStyle}>Phone number</label>
          <div
            className="field-input"
            style={{
              display: 'flex',
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'hidden',
              background: 'var(--surface2)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <select
              value={countryCode}
              onChange={(e) => {
                const code = e.target.value
                setCountryCode(code)
                setPhone(code + localNumber)
              }}
              style={{
                background: 'var(--surface2)',
                border: 'none',
                borderRight: '1px solid var(--border)',
                padding: '0.8rem 0.4rem 0.8rem 0.75rem',
                color: 'var(--text)',
                fontFamily: "'Archivo', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code} style={{ background: '#161616' }}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              value={localNumber}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, '')
                setLocalNumber(cleaned)
                setPhone(countryCode + cleaned)
              }}
              onKeyDown={(e) => {
                if (e.ctrlKey || e.metaKey) return
                if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
                if (!/^[0-9]$/.test(e.key)) e.preventDefault()
              }}
              placeholder="7911 123456"
              required
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '0.8rem 1rem',
                color: 'var(--text)',
                fontFamily: "'Archivo', sans-serif",
                fontSize: '15px',
                fontWeight: 600,
                outline: 'none',
                minWidth: 0,
              }}
            />
          </div>
          {phoneError && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{phoneError}</div>}
        </div>
        {!challengeSessionId && (
          <div>
            <label style={labelStyle}>Game type</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(
                [
                  ['private', 'Private'],
                  ['looking_for_opposition', 'Looking for opposition'],
                  ['open', 'Open to anyone'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setGameType(value)
                    if (value !== 'looking_for_opposition') setTeamName('')
                  }}
                  style={{
                    flex: 1,
                    padding: '0.65rem 0.3rem',
                    borderRadius: '8px',
                    border: gameType === value ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    background: gameType === value ? '#C6F135' : '#1a1a1a',
                    color: gameType === value ? '#000' : '#fff',
                    fontFamily: "'Archivo', sans-serif",
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    lineHeight: 1.2,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {gameType === 'looking_for_opposition' && !challengeSessionId && (
          <div>
            <label style={labelStyle}>Team name (optional)</label>
            <input
              className="field-input"
              type="text"
              value={teamName}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9\s]/g, '')
                setTeamName(cleaned.slice(0, 30))
              }}
              placeholder="e.g. Sunday Ballers"
              style={inputStyle}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(255,68,68,0.08)',
              border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              fontSize: '13px',
              color: 'var(--red)',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isReady}
          className={!loading && isReady ? 'btn-g' : ''}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '12px',
            border: 'none',
            cursor: loading || !isReady ? 'not-allowed' : 'pointer',
            background: loading || !isReady ? 'var(--surface2)' : 'var(--green)',
            color: loading || !isReady ? 'var(--muted)' : 'var(--black)',
            fontFamily: "'Archivo Black', sans-serif",
            fontWeight: 900,
            fontSize: '16px',
            letterSpacing: '-0.025em',
            marginTop: '4px',
            transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
            lineHeight: 1,
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
