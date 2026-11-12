'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import PhoneInput from '@/components/PhoneInput'
import { pounds } from '@/lib/games'
import {
  readPlayerDetails, readSessionPlayer, removeSessionPlayer, writePlayerDetails, writeSessionPlayer,
} from '@/lib/clientStorage'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, { locale: 'en-GB' })

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.8rem 0.9rem', background: 'var(--surface2)',
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)',
  color: 'var(--text)', fontSize: '16px', fontFamily: 'var(--font-sans)',
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '1rem', fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: 700,
  border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', background: 'var(--green)', color: 'var(--black)',
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '10px', padding: '0.85rem 1rem', margin: '0 0 1rem', fontSize: '14px', color: 'var(--red)', fontWeight: 600 }}>
      {message}
    </div>
  )
}

function HoldForm({
  gameId, name, phone, totalPence, onDone,
}: {
  gameId: string
  name: string
  phone: string
  totalPence: number
  onDone: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || busy) return
    setBusy(true)
    setError('')
    try {
      const { error: elError } = await elements.submit()
      if (elError) { setError(elError.message ?? 'Check your card details'); return }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: `${window.location.origin}/game/${gameId}` },
      })
      if (confirmError) { setError(confirmError.message ?? 'Your card could not be held'); return }
      if (!paymentIntent || paymentIntent.status !== 'requires_capture') {
        setError('Your card could not be held. Try another card.')
        return
      }

      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: gameId, paymentIntentId: paymentIntent.id, name, phone }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not join'); return }

      try {
        writePlayerDetails(name, phone)
        writeSessionPlayer(gameId, name, phone)
      } catch { /* ignore */ }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ background: 'var(--green-faint)', border: '1px solid var(--border-active)', borderRadius: 'var(--radius-lg)', padding: '0.9rem 1.1rem', marginBottom: '1.1rem', fontSize: '14px', lineHeight: 1.6 }}>
        <strong>You&apos;re not charged yet.</strong> {pounds(totalPence)} is held on your card. It&apos;s only taken once the organiser has booked the pitch. If the game doesn&apos;t go ahead, the hold is released and you pay nothing. Some banks show the hold as pending for a few days.
      </div>
      <div style={{ marginBottom: '1.1rem' }}>
        <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' } }} />
      </div>
      <ErrorBox message={error} />
      <button type="submit" disabled={busy || !stripe} style={{ ...primaryBtn, opacity: busy || !stripe ? 0.6 : 1 }}>
        {busy ? 'Holding…' : `Hold ${pounds(totalPence)} and join`}
      </button>
    </form>
  )
}

export default function JoinPanel({
  gameId, totalPence, isLoggedIn, joinedAsUser, leaveOnly = false,
}: {
  gameId: string
  totalPence: number
  isLoggedIn: boolean
  joinedAsUser: boolean
  leaveOnly?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [guestPhone, setGuestPhone] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = readPlayerDetails()
    // Reading localStorage must happen after mount (it doesn't exist during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) { setName(saved.name); setPhone(saved.phone) }
    const me = readSessionPlayer(gameId)
    if (me) setGuestPhone(me.phone)
  }, [gameId])

  const joined = joinedAsUser || guestPhone !== null

  async function startHold(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/games/${gameId}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json()
      if (!res.ok || !data.clientSecret) { setError(data.error ?? 'Could not start the payment'); return }
      setClientSecret(data.clientSecret)
    } catch {
      setError('Could not start the payment')
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: gameId, phone: guestPhone ?? (phone || undefined) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not leave'); return }
      removeSessionPlayer(gameId)
      setGuestPhone(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (joined) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '0.4rem' }}>You&apos;re in.</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.65, marginBottom: '1rem' }}>
          {pounds(totalPence)} is held on your card and only taken once the organiser has booked the pitch.
        </p>
        <ErrorBox message={error} />
        <button onClick={leave} disabled={busy} style={{ ...primaryBtn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', fontSize: '14px', padding: '0.8rem' }}>
          {busy ? 'Leaving…' : 'Leave and release my card'}
        </button>
      </div>
    )
  }

  if (leaveOnly) return null

  if (clientSecret) {
    return (
      <Elements
        key={clientSecret}
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'night',
            variables: { colorPrimary: '#E4FF3A', colorBackground: '#14294A', colorText: '#F4F7FB', colorTextSecondary: '#A7B4C8', colorDanger: '#FF4444', borderRadius: '10px' },
          },
        }}
      >
        <HoldForm
          gameId={gameId}
          name={name}
          phone={phone}
          totalPence={totalPence}
          onDone={() => router.refresh()}
        />
      </Elements>
    )
  }

  return (
    <form onSubmit={startHold}>
      <h2 style={{ fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '1rem' }}>Join this game</h2>
      <div style={{ marginBottom: '1.1rem' }}>
        <label style={labelStyle} htmlFor="pname">Your name</label>
        <input id="pname" style={inputStyle} value={name} onChange={e => setName(e.target.value)} required maxLength={100} />
      </div>
      <div style={{ marginBottom: '1.1rem' }}>
        <label style={labelStyle} htmlFor="pphone">Phone number</label>
        <PhoneInput id="pphone" value={phone} onChange={setPhone} required />
      </div>
      {!isLoggedIn && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '1rem' }}>
          No account needed. Your number is only used so you can leave the game.
        </p>
      )}
      <ErrorBox message={error} />
      <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'One moment…' : 'Continue to card'}
      </button>
    </form>
  )
}
