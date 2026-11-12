'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLAYER_FEE_PENCE } from '@/lib/stripe-constants'
import { MAX_DAYS_AHEAD, addDays, londonToday, paidSpots, pounds, sharePence } from '@/lib/games'

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem 0.9rem',
  background: 'var(--surface2)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--text)',
  fontSize: '16px',
  fontFamily: 'var(--font-sans)',
}
const fieldStyle: React.CSSProperties = { marginBottom: '1.1rem' }

export default function CreateGameForm({
  payoutsReady,
  hasAccount,
  defaultName,
}: {
  payoutsReady: boolean
  hasAccount: boolean
  defaultName: string
}) {
  const router = useRouter()
  const today = londonToday()

  const [organiserName, setOrganiserName] = useState(defaultName)
  const [title, setTitle] = useState('')
  const [venueName, setVenueName] = useState('')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('19:00')
  const [totalPounds, setTotalPounds] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('10')
  const [organiserPlays, setOrganiserPlays] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => {
    const total = Math.round(Number(totalPounds) * 100)
    const max = Number(maxPlayers)
    if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(max) || max < 2) return null
    const share = sharePence(total, max)
    const spots = paidSpots({ max_players: max, organiser_plays: organiserPlays })
    return { share, spots, playerPays: share + PLAYER_FEE_PENCE, youReceive: share * spots }
  }, [totalPounds, maxPlayers, organiserPlays])

  async function startPayouts() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/organiser/onboarding', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not start payout setup')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not start payout setup')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organiserName, title, venueName, date, startTime,
          totalPounds: Number(totalPounds), maxPlayers: Number(maxPlayers), organiserPlays,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not create the game')
        return
      }
      router.push(`/game/${data.id}`)
    } catch {
      setError('Could not create the game')
    } finally {
      setBusy(false)
    }
  }

  const wrap: React.CSSProperties = { maxWidth: '520px', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }
  const errorBox = error ? (
    <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '10px', padding: '0.85rem 1rem', margin: '0 0 1rem', fontSize: '14px', color: 'var(--red)', fontWeight: 600 }}>
      {error}
    </div>
  ) : null

  if (!payoutsReady) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 'var(--text-h2)', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>Set up payouts first</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '1.25rem' }}>
          Players pay through BookMyPitch and the money goes straight to you. Stripe needs your details and bank account once, which takes about five minutes. You only do this the first time.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '1.5rem' }}>
          {hasAccount ? 'You started this before but did not finish. Pick up where you left off.' : 'Payouts to your bank usually arrive a few days after you confirm a game.'}
        </p>
        {errorBox}
        <button
          onClick={startPayouts}
          disabled={busy}
          className="bmp-btn bmp-btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '19px', fontFamily: 'var(--font-condensed)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--green)', color: 'var(--black)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Opening Stripe…' : hasAccount ? 'Continue payout setup' : 'Set up payouts'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={wrap}>
      <h1 style={{ fontSize: 'var(--text-h2)', letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Create a game</h1>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
        Share the link in your group chat. Players put their card on hold and nobody is charged until you&apos;ve booked the pitch.
      </p>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="name">Your name</label>
        <input id="name" style={inputStyle} value={organiserName} onChange={e => setOrganiserName(e.target.value)} required maxLength={100} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="title">Game name (optional)</label>
        <input id="title" style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Thursday 5-a-side" maxLength={80} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="venue">Pitch or venue</label>
        <input id="venue" style={inputStyle} value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="Where you'll book" required maxLength={100} />
      </div>
      <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="date">Date</label>
          <input id="date" type="date" style={inputStyle} value={date} min={today} max={addDays(today, MAX_DAYS_AHEAD)} onChange={e => setDate(e.target.value)} required />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="time">Kick-off</label>
          <input id="time" type="time" style={inputStyle} value={startTime} onChange={e => setStartTime(e.target.value)} required />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', ...fieldStyle }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="cost">Total pitch cost (£)</label>
          <input id="cost" type="number" inputMode="decimal" min="1" max="500" step="0.01" style={inputStyle} value={totalPounds} onChange={e => setTotalPounds(e.target.value)} required />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="players">Total players</label>
          <input id="players" type="number" inputMode="numeric" min="2" max="22" style={inputStyle} value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} required />
        </div>
      </div>
      <label style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1.25rem', color: 'var(--text)', fontSize: '15px' }}>
        <input type="checkbox" checked={organiserPlays} onChange={e => setOrganiserPlays(e.target.checked)} />
        I&apos;m playing (my share isn&apos;t collected here)
      </label>

      {preview && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1.1rem 1.25rem', marginBottom: '1.25rem', fontSize: '14px', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          <div>Each player&apos;s share: <strong style={{ color: 'var(--text)' }}>{pounds(preview.share)}</strong></div>
          <div>Each player pays: <strong style={{ color: 'var(--text)' }}>{pounds(preview.playerPays)}</strong> (share plus {PLAYER_FEE_PENCE}p fee)</div>
          <div>{preview.spots} paying player{preview.spots === 1 ? '' : 's'}. You receive: <strong style={{ color: 'var(--green)' }}>{pounds(preview.youReceive)}</strong></div>
        </div>
      )}

      {errorBox}
      <button
        type="submit"
        disabled={busy}
        className="bmp-btn bmp-btn-primary"
        style={{ width: '100%', padding: '1rem', fontSize: '19px', fontFamily: 'var(--font-condensed)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--green)', color: 'var(--black)', border: 'none', borderRadius: 'var(--radius-lg)', cursor: busy ? 'wait' : 'pointer' }}
      >
        {busy ? 'Creating…' : 'Create game and get link'}
      </button>
    </form>
  )
}
