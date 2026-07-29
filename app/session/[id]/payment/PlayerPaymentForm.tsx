'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createClient } from '@/lib/supabase/client'
import { writePlayerDetails, writeSessionPlayer, upsertMySession } from '@/lib/clientStorage'
import { Pitch } from '@/lib/slots'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
  betas: [],
  locale: 'en-GB',
})

interface SlotData {
  id: string
  price: number
  max_players: number
  pitches: Pitch
}

interface Props {
  sessionId: string
  slot: SlotData
  existingPlayerCount: number
  hasRival: boolean
  isLoggedIn: boolean
}

function CardForm({
  slot,
  sessionId,
  name,
  phone,
  customerId,
  hasRival,
  onSuccess,
  onConfirmError,
  parentDisabled,
  onBack,
}: {
  slot: SlotData
  sessionId: string
  name: string
  phone: string
  customerId: string
  hasRival: boolean
  onSuccess: (dest: string) => void
  onConfirmError: (message: string) => void
  parentDisabled: boolean
  onBack: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const pitchPerPlayer = slot.price / slot.pitches.max_players
  const totalPerPlayer = (pitchPerPlayer + 0.50 + 0.30).toFixed(2)
  const isDisabled = loading || parentDisabled || !stripe

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isDisabled || !elements) return
    setLoading(true)
    setSubmitError('')

    try {
      const { error: elError } = await elements.submit()
      if (elError) {
        setSubmitError(elError.message ?? 'Please check your card details.')
        return
      }

      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/session/${sessionId}`,
        },
      })

      if (confirmError) {
        onConfirmError(confirmError.message ?? 'Payment setup failed')
        return
      }

      if (!setupIntent?.payment_method) {
        setSubmitError('Could not save payment method')
        return
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id

      if (!paymentMethodId) {
        setSubmitError('Could not read payment method ID')
        return
      }

      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          sessionId,
          isOrganiser: false,
          name,
          phone,
          paymentMethodId,
          customerId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to join session')
        return
      }

      onSuccess(`/session/${data.sessionId}?joined=1`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {hasRival && (
        <div
          style={{
            background: 'rgba(255,184,0,0.06)',
            border: '1px solid rgba(255,184,0,0.22)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.25rem',
            fontSize: '14px',
            color: 'var(--amber)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            lineHeight: 1.55,
            fontWeight: 600,
          }}
        >
          <span style={{ flexShrink: 0 }}>⚡</span>
          Another group is also trying to fill this slot. First to {slot.pitches.max_players} gets it.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '10px',
          background: 'rgba(198,241,53,0.05)',
          border: '1px solid rgba(198,241,53,0.15)',
          borderRadius: '12px',
          padding: '1rem 1.1rem',
          marginBottom: '1.25rem',
          fontSize: '14px',
          color: 'rgba(198,241,53,0.7)',
          lineHeight: 1.6,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ flexShrink: 0, marginTop: '1px' }}>🔒</span>
        <span>
          <strong style={{ color: 'var(--green)' }}>Nothing is charged now.</strong>{' '}
          Your card is only charged when all {slot.pitches.max_players} players join. If the game doesn&apos;t fill, you pay nothing.
        </span>
      </div>

      <div
        style={{
          background: 'linear-gradient(145deg, rgba(198,241,53,0.04) 0%, #0f0f0f 100%)',
          border: '1px solid rgba(198,241,53,0.12)',
          borderRadius: '16px',
          padding: '1.4rem 1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        {[
          { label: `Pitch hire split (£${slot.price} / ${slot.pitches.max_players})`, amount: `£${pitchPerPlayer.toFixed(2)}` },
          { label: 'Booking fee', amount: '50p' },
          { label: 'Payment handling', amount: '30p' },
        ].map(row => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: 'var(--muted)',
              marginBottom: '8px',
              fontWeight: 500,
            }}
          >
            <span>{row.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{row.amount}</span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            color: 'var(--text)',
            fontWeight: 800,
            fontSize: '14px',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(198,241,53,0.12)',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--muted)' }}>Total if confirmed</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              color: 'var(--green)',
              letterSpacing: '-0.04em',
            }}
          >
            £{totalPerPlayer}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.6, fontWeight: 500 }}>
          You&apos;ll get a text the moment it&apos;s confirmed. Less than a coffee.
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label
          style={{
            fontSize: '10px',
            color: 'var(--muted)',
            marginBottom: '7px',
            display: 'block',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
          }}
        >
          Payment method
        </label>
        <PaymentElement
          options={{
            layout: 'tabs',
            wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
          }}
        />
      </div>

      {submitError && (
        <div
          style={{
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.2)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            fontSize: '13px',
            color: 'var(--red)',
            fontWeight: 600,
          }}
        >
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={isDisabled}
        className={!isDisabled ? 'btn-g' : ''}
        style={{
          width: '100%',
          padding: '1rem',
          fontSize: '16px',
          borderRadius: '12px',
          border: 'none',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          background: isDisabled ? 'var(--surface2)' : 'var(--green)',
          color: isDisabled ? 'var(--muted)' : 'var(--black)',
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          letterSpacing: '-0.025em',
          transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
          marginBottom: '8px',
          lineHeight: 1,
        }}
      >
        {loading ? 'Processing...' : parentDisabled ? 'Refreshing payment form…' : `Join — only £${totalPerPlayer} if confirmed`}
      </button>

      <div
        style={{
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--muted)',
          marginBottom: '1rem',
          fontWeight: 500,
        }}
      >
        Secured by Stripe · Card only charged when game is full
      </div>

      <button
        type="button"
        onClick={onBack}
        style={{
          width: '100%',
          padding: '0.8rem',
          fontSize: '14px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          background: 'transparent',
          color: 'var(--muted)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
          lineHeight: 1,
        }}
      >
        ← Back
      </button>
    </form>
  )
}

export default function PlayerPaymentForm({ sessionId, slot, existingPlayerCount: _existingPlayerCount, hasRival, isLoggedIn }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupKey, setSetupKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    const ss = sessionStorage.getItem('join_details')
    if (!ss) {
      router.replace(`/session/${sessionId}`)
      return
    }
    let n = '', p = ''
    try {
      const parsed = JSON.parse(ss)
      n = parsed.name ?? ''
      p = parsed.phone ?? ''
    } catch {
      router.replace(`/session/${sessionId}`)
      return
    }
    if (!n || !p) {
      router.replace(`/session/${sessionId}`)
      return
    }
    setName(n)
    setPhone(p)

    fetch('/api/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, phone: p, sessionId }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.clientSecret) {
          setError(data.error ?? 'Failed to initialise payment')
        } else {
          setClientSecret(data.clientSecret)
          setCustomerId(data.customerId)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to initialise payment')
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConfirmError(message: string) {
    setPaymentError(message)
    setRefreshing(true)
    try {
      const res = await fetch('/api/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, sessionId }),
      })
      const data = await res.json()
      if (res.ok && data.clientSecret && data.customerId) {
        setClientSecret(data.clientSecret)
        setCustomerId(data.customerId)
        setSetupKey(k => k + 1)
      }
    } catch {
      // leave form in place
    } finally {
      setRefreshing(false)
    }
  }

  function handleSuccess(dest: string) {
    sessionStorage.removeItem('join_details')
    if (!isLoggedIn) {
      try {
        writePlayerDetails(name, phone)
        const sid = dest.split('/session/')[1]?.split('?')[0]
        if (sid) {
          upsertMySession(sid, name)
          writeSessionPlayer(sid, name, phone)
        }
      } catch { /* ignore */ }
    } else {
      supabase.auth.updateUser({ data: { phone } }).catch(() => {})
    }
    router.push(dest)
  }

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#C6F135',
      colorBackground: '#161616',
      colorText: '#F7F4EE',
      colorDanger: '#FF4444',
      fontFamily: 'var(--font-sans)',
      borderRadius: '10px',
    },
  }

  if (loading) {
    return (
      <div
        style={{
          maxWidth: '480px',
          margin: '4rem auto',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '15px',
        }}
      >
        Setting up payment…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div
          style={{
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.2)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            fontSize: '14px',
            color: 'var(--red)',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
        <button
          onClick={() => router.push(`/session/${sessionId}`)}
          style={{
            width: '100%',
            padding: '0.85rem',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--muted)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ← Back to game
        </button>
      </div>
    )
  }

  if (!clientSecret) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      <div
        className="anim-fade-up"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 5vw, 30px)',
          letterSpacing: '-0.04em',
          marginBottom: '0.4rem',
          lineHeight: 0.92,
        }}
      >
        Add your card
      </div>
      <div
        style={{
          fontSize: '15px',
          color: 'var(--muted)',
          marginBottom: '1.75rem',
          fontWeight: 500,
          lineHeight: 1.6,
        }}
      >
        Joining as <strong style={{ color: 'var(--text)' }}>{name}</strong>
      </div>

      {paymentError && (
        <div
          style={{
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.2)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            fontSize: '13px',
            color: 'var(--red)',
            fontWeight: 600,
          }}
        >
          {paymentError}
        </div>
      )}

      <Elements key={setupKey} stripe={stripePromise} options={{ clientSecret, appearance }}>
        <CardForm
          slot={slot}
          sessionId={sessionId}
          name={name}
          phone={phone}
          customerId={customerId}
          hasRival={hasRival}
          onSuccess={handleSuccess}
          onConfirmError={handleConfirmError}
          parentDisabled={refreshing}
          onBack={() => router.push(`/session/${sessionId}`)}
        />
      </Elements>
    </div>
  )
}
