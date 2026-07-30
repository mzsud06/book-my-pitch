'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import PhoneInput, { parsePhone } from '@/components/PhoneInput'
import { Pitch } from '@/lib/slots'

interface Slot {
  id: string
  date: string
  start_time: string
  end_time: string
  type: string
  price: number
  max_players: number
  pitches: Pitch
  venue: { name: string; address: string } | null
}

interface Props {
  slot: Slot
  slotIds: string[]
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
  borderRadius: 'var(--radius-lg)',
  padding: '0.875rem 1rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: '15px',
  fontWeight: 500,
  outline: 'none',
  minHeight: '48px',
  transition: 'border-color 160ms ease, box-shadow 160ms ease',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  marginBottom: '8px',
  display: 'block',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontFamily: 'var(--font-sans)',
}

export default function CreateSessionForm({ slot, slotIds }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+44')
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [gameType, setGameType] = useState<'private' | 'open'>('private')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setChecking(false)
        return
      }

      // Check as organiser for existing session on this slot
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

      // Autofill for logged-in users
      const meta = user.user_metadata as Record<string, unknown>
      const metaName = typeof meta?.name === 'string' ? meta.name : ''
      if (metaName) setName(metaName)

      const metaPhone = typeof meta?.phone === 'string' ? meta.phone : ''
      if (metaPhone) {
        setPhone(metaPhone)
      } else {
        // Fall back to most recent player row for this user (phone isn't
        // selectable by the browser client, so this goes through an API route)
        const { phone: storedPhone } = await fetch('/api/latest-phone').then(r => r.json())
        if (storedPhone) {
          setPhone(storedPhone)
        }
      }

      setChecking(false)
    }
    init()
  }, [slot.id])

  const perPlayer = (slot.price / slot.pitches.max_players).toFixed(2)
  const typeLabel = slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'
  const startTime = slot.start_time.slice(0, 5)
  const endTime = slot.end_time.slice(0, 5)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let valid = true
    if (!name.trim() || !/^[A-Za-z ]+$/.test(name.trim())) {
      setNameError('Name may only contain letters and spaces')
      valid = false
    }
    const { localNumber } = parsePhone(phone)
    if (!localNumber.trim() || !/^[0-9]+$/.test(localNumber.trim())) {
      setPhoneError('Please enter a valid phone number')
      valid = false
    }
    if (!valid) return
    const trimmedPhone = phone.trim()
    sessionStorage.setItem('bmp_create_details', JSON.stringify({
      name: name.trim(),
      phone: trimmedPhone,
      gameType,
      slotIds,
    }))
    // Ensure JoinForm on the create payment page can read the same values
    sessionStorage.setItem('join_details', JSON.stringify({ name: name.trim(), phone: trimmedPhone }))
    // Persist phone to user metadata for future autofill (fire-and-forget)
    supabase.auth.updateUser({ data: { phone: trimmedPhone } }).catch(() => {})
    const query = new URLSearchParams({ slotIds: slotIds.join(',') })
    router.push(`/slots/create/${slot.id}/payment?${query.toString()}`)
  }

  const isReady = name.trim() && parsePhone(phone).localNumber.trim()

  if (checking) return null

  if (existingSessionId) return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 4vw, 30px)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginBottom: '1rem',
        }}
      >
        You already have a game for this game time.
      </div>
      <Link href={`/session/${existingSessionId}`} style={{ textDecoration: 'none' }}>
        <button
          style={{
            padding: '0.875rem 2rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            background: 'var(--green)',
            color: 'var(--black)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '-0.015em',
            cursor: 'pointer',
            lineHeight: 1,
            minHeight: '48px',
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
          color: 'var(--text-tertiary)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontFamily: 'var(--font-sans)',
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
        Create your game
      </div>
      <div
        className="anim-fade-up d-80"
        style={{
          fontFamily: 'var(--font-display)',
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
        style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '2rem', fontWeight: 500, fontFamily: 'var(--font-sans)' }}
      >
        {formatDate(slot.date)} · {typeLabel} · {slot.venue?.name ?? 'your local pitch'}
      </div>

      {/* Slot summary card */}
      <div
        className="anim-fade-up d-200"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
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
                color: 'var(--text-tertiary)',
                marginBottom: '4px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {slot.venue?.name ?? 'your local pitch'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {slot.venue?.address ?? ''}
            </div>
            <div style={{ marginTop: '10px' }}>
              <Badge variant={slot.type === 'peak' ? 'peak' : slot.type === 'offpeak' ? 'offpeak' : 'weekend'}>
                {typeLabel}
              </Badge>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '30px',
                color: 'var(--green)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              £{perPlayer}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>per player</div>
          </div>
        </div>

        {/* Team lineup — split into two rows */}
        <div style={{ marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: Math.ceil(slot.pitches.max_players / 2) }, (_, i) => (
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
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
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
              {slot.pitches.format}
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </div>

          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: Math.floor(slot.pitches.max_players / 2) }, (_, i) => (
              <div
                key={i + Math.ceil(slot.pitches.max_players / 2)}
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
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: 'rgba(255,255,255,0.06)',
                    lineHeight: 1,
                  }}
                >
                  {i + Math.ceil(slot.pitches.max_players / 2) + 1}
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
        </div>

        {/* Segmented bar */}
        <div className="seg-bar" style={{ marginBottom: '10px' }}>
          {Array.from({ length: slot.pitches.max_players }, (_, i) => (
            <div
              key={i}
              className={`seg-bar-seg ${i === 0 ? 'lit-green' : 'unlit'}`}
              style={{ transitionDelay: `${i * 25}ms` }}
            />
          ))}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 500 }}>
          <strong style={{ color: 'var(--text)', fontWeight: 800 }}>1/{slot.pitches.max_players} players</strong>
          {' '}— {slot.pitches.max_players - 1} more needed to confirm
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
              const cleaned = e.target.value.replace(/[^a-zA-Z0-9\s]/g, '')
              setName(cleaned)
            }}
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey) return
              if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
              if (!/^[a-zA-Z0-9\s]$/.test(e.key)) e.preventDefault()
            }}
            placeholder="Full name"
            required
            style={inputStyle}
          />
          {nameError && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{nameError}</div>}
        </div>
        <div>
          <label style={labelStyle}>Phone number</label>
          <PhoneInput value={phone} onChange={setPhone} required />
          {phoneError && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{phoneError}</div>}
        </div>
        <div>
          <label style={labelStyle}>Game type</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(
              [
                ['private', 'Private'],
                ['open', 'Public'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGameType(value)}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.3rem',
                  minHeight: '44px',
                  borderRadius: 'var(--radius-sm)',
                  border: gameType === value ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  background: gameType === value ? 'var(--green)' : 'var(--surface2)',
                  color: gameType === value ? 'var(--black)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  lineHeight: 1.2,
                  textAlign: 'center' as const,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={!isReady}
          className={isReady ? 'btn-g' : ''}
          style={{
            width: '100%',
            minHeight: '52px',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            cursor: !isReady ? 'not-allowed' : 'pointer',
            background: !isReady ? 'var(--surface2)' : 'var(--green)',
            color: !isReady ? 'var(--text-secondary)' : 'var(--black)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '-0.015em',
            marginTop: '4px',
            opacity: !isReady ? 0.5 : 1,
            transition: 'background 160ms ease, color 160ms ease, transform 160ms var(--ease-out), box-shadow 160ms ease',
            lineHeight: 1,
          }}
        >
          Continue to payment →
        </button>
      </form>
    </div>
  )
}
