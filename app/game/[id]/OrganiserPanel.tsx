'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pounds } from '@/lib/games'

const btn: React.CSSProperties = {
  width: '100%', padding: '1rem', fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: 700,
  border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', lineHeight: 1,
}

export default function OrganiserPanel({
  gameId, status, deadline, collectPence, filled, spots,
}: {
  gameId: string
  status: string
  deadline: string | null
  collectPence: number
  filled: number
  spots: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/game/${gameId}`

  async function act(kind: 'confirm' | 'cancel') {
    setBusy(kind)
    setError('')
    try {
      const res = await fetch(`/api/games/${gameId}/${kind}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Something went wrong')
      router.refresh()
    } catch {
      setError('Something went wrong')
    } finally {
      setBusy('')
      setConfirmCancel(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const panel: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1rem' }
  const errorBox = error ? (
    <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '14px', color: 'var(--red)', fontWeight: 600 }}>
      {error}
    </div>
  ) : null

  if (status === 'full') {
    return (
      <>
        <div style={{ ...panel, borderColor: 'var(--border-active)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Everyone has paid. Book the pitch now.
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.65 }}>
            Book it with the venue, then tap the green button. The players&apos; cards are charged and {pounds(collectPence)} goes to you.
            If the slot has gone, tap the other button and nobody is charged.
            {deadline && <> You have until {new Date(deadline).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.</>}
          </p>
        </div>
        {errorBox}
        <button onClick={() => act('confirm')} disabled={!!busy} style={{ ...btn, background: 'var(--green)', color: 'var(--black)', marginBottom: '10px' }}>
          {busy === 'confirm' ? 'Charging players…' : "I've booked it"}
        </button>
        <button onClick={() => act('cancel')} disabled={!!busy} style={{ ...btn, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border-strong)' }}>
          {busy === 'cancel' ? 'Cancelling…' : "Slot's gone, cancel"}
        </button>
      </>
    )
  }

  if (status === 'confirmed') {
    return (
      <div style={panel}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '0.4rem' }}>
          {pounds(collectPence)} is on its way to you.
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.65 }}>
          It lands in your Stripe balance now and pays out to your bank within a few days.
        </p>
      </div>
    )
  }

  if (status !== 'filling') return null

  return (
    <>
      <div style={panel}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '0.4rem' }}>Share this link</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.65, marginBottom: '0.9rem' }}>
          Drop it in the group chat. {filled}/{spots} paid so far. You&apos;ll get an email when it&apos;s full.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input readOnly value={link} style={{ flex: 1, minWidth: 0, padding: '0.7rem 0.8rem', background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', color: 'var(--text)', fontSize: '14px' }} />
          <button onClick={copy} style={{ padding: '0 1rem', background: 'var(--green)', color: 'var(--black)', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer' }}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Football, join here (you're only charged once it's booked): ${link}`)}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 600 }}
        >
          Send on WhatsApp
        </a>
      </div>
      {errorBox}
      {confirmCancel ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => act('cancel')} disabled={!!busy} style={{ ...btn, background: 'var(--red)', color: '#fff' }}>
            {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel and release all cards'}
          </button>
          <button onClick={() => setConfirmCancel(false)} style={{ ...btn, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border-strong)' }}>
            Keep
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmCancel(true)} style={{ ...btn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
          Cancel this game
        </button>
      )}
    </>
  )
}
