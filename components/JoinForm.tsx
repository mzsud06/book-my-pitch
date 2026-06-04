'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createClient } from '@/lib/supabase/client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const LS_KEY = 'bmp_player_details'

interface SlotData {
  id: string
  date: string
  start_time: string
  end_time: string
  type: string
  price: number
  max_players: number
}

interface Props {
  slot: SlotData
  isOrganiser: boolean
  sessionId: string | null
  existingPlayerCount?: number
  hasRival?: boolean
  isLoggedIn?: boolean
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function sliceTime(t: string): string {
  return t ? t.slice(0, 5) : t
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

// ---------------------------------------------------------------------------
// PaymentStep
// ---------------------------------------------------------------------------
function PaymentStep({
  slot,
  sessionId,
  isOrganiser,
  clientSecret,
  customerId,
  name,
  phone,
  existingPlayerCount,
  hasRival,
  onBack,
  onSuccess,
}: {
  slot: SlotData
  sessionId: string | null
  isOrganiser: boolean
  clientSecret: string
  customerId: string
  name: string
  phone: string
  existingPlayerCount: number
  hasRival: boolean
  onBack: () => void
  onSuccess: (dest: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pitchPerPlayer = slot.price / 10
  const bookingFee = 0.50
  const handling = 0.30
  const totalPerPlayer = (pitchPerPlayer + bookingFee + handling).toFixed(2)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError('')

    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/session/${sessionId ?? 'new'}`,
        },
      })

      if (confirmError) {
        console.error('stripe.confirmSetup error:', {
          type: confirmError.type,
          code: confirmError.code,
          declineCode: (confirmError as { decline_code?: string }).decline_code,
          message: confirmError.message,
        })
        setError(confirmError.message ?? 'Payment setup failed')
        return
      }

      if (!setupIntent?.payment_method) {
        setError('Could not save payment method')
        return
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id

      if (!paymentMethodId) {
        setError('Could not read payment method ID')
        return
      }

      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          sessionId,
          isOrganiser,
          name,
          phone,
          paymentMethodId,
          customerId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to join session')
        return
      }

      sessionStorage.removeItem('join_details')

      const dest = isOrganiser
        ? `/session/${data.sessionId}?created=1`
        : `/session/${data.sessionId}?joined=1`
      onSuccess(dest)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {hasRival && (
        <div
          style={{
            background: 'rgba(255,184,0,0.07)',
            border: '1px solid rgba(255,184,0,0.22)',
            borderRadius: '10px',
            padding: '0.8rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '14px',
            color: 'var(--amber)',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            lineHeight: 1.55,
            fontWeight: 600,
          }}
        >
          ⚡ Another group is also trying to fill this slot. First to 10 gets it.
        </div>
      )}

      {/* Nothing charged callout */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          background: 'rgba(198,241,53,0.06)',
          border: '1px solid rgba(198,241,53,0.14)',
          borderRadius: '10px',
          padding: '0.9rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '14px',
          color: 'rgba(198,241,53,0.75)',
          lineHeight: 1.55,
        }}
      >
        🔒{' '}
        <span>
          <strong style={{ color: 'var(--green)' }}>Nothing is charged now.</strong> Your card is only charged when the 10th player joins. If the session doesn&apos;t fill, you pay nothing.
        </span>
      </div>

      {/* Cost breakdown */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(198,241,53,0.04) 0%, var(--surface) 100%)',
          border: '1px solid rgba(198,241,53,0.12)',
          borderRadius: '14px',
          padding: '1.3rem 1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        {[
          { label: `Pitch hire split (£${slot.price} / 10)`, amount: `£${pitchPerPlayer.toFixed(2)}` },
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
            <span style={{ fontWeight: 700 }}>{row.amount}</span>
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
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(198,241,53,0.12)',
          }}
        >
          <span>Total if confirmed</span>
          <span
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '24px',
              color: 'var(--green)',
              letterSpacing: '-0.04em',
            }}
          >
            £{totalPerPlayer}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.55, fontWeight: 500 }}>
          You&apos;ll get a text the moment it&apos;s confirmed. Less than a coffee.
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>Payment method</label>
        <PaymentElement
          options={{
            layout: 'tabs',
            wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
          }}
        />
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(255,68,68,0.1)',
            border: '1px solid rgba(255,68,68,0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '13px',
            color: 'var(--red)',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className={!loading && stripe ? 'btn-g' : ''}
        style={{
          width: '100%',
          padding: '0.95rem',
          fontSize: '15px',
          borderRadius: '10px',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--surface2)' : 'var(--green)',
          color: loading ? 'var(--muted)' : 'var(--black)',
          fontFamily: "'Archivo Black', sans-serif",
          fontWeight: 800,
          letterSpacing: '-0.02em',
          transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
          marginBottom: '8px',
        }}
      >
        {loading ? 'Processing...' : `Join — only £${totalPerPlayer} if confirmed`}
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
        🔒 Secured by Stripe · Card only charged when session is full
      </div>

      <button
        type="button"
        onClick={onBack}
        className="btn-ghost"
        style={{
          width: '100%',
          padding: '0.7rem',
          fontSize: '14px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          background: 'transparent',
          color: 'var(--muted)',
          fontFamily: "'Archivo', sans-serif",
          fontWeight: 600,
          transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.12s ease',
        }}
      >
        ← Back
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// JoinForm (main export)
// ---------------------------------------------------------------------------
export default function JoinForm({
  slot,
  isOrganiser,
  sessionId,
  existingPlayerCount = 0,
  hasRival = false,
  isLoggedIn = false,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const stepParam = searchParams.get('step')
  const step: 'details' | 'payment' = stepParam === 'payment' ? 'payment' : 'details'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [setupError, setSetupError] = useState('')

  const didAutoAdvance = useRef(false)
  const [joinDest, setJoinDest] = useState<string | null>(null)

  useEffect(() => {
    const ss = sessionStorage.getItem('join_details')
    if (ss) {
      try {
        const { name: n, phone: p } = JSON.parse(ss)
        if (n) setName(n)
        if (p) setPhone(p)
        return
      } catch { /* ignore */ }
    }
    try {
      const ls = localStorage.getItem(LS_KEY)
      if (ls) {
        const { name: n, phone: p } = JSON.parse(ls)
        if (n) setName(n)
        if (p) setPhone(p)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!isOrganiser || didAutoAdvance.current || !name || !phone) return
    didAutoAdvance.current = true
    initSetupIntent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, isOrganiser])

  useEffect(() => {
    if (!sessionId || isLoggedIn) return
    try {
      let savedPhone: string | null = null
      const ss = sessionStorage.getItem('join_details')
      if (ss) savedPhone = JSON.parse(ss).phone ?? null
      if (!savedPhone) {
        const ls = localStorage.getItem(LS_KEY)
        if (ls) savedPhone = JSON.parse(ls).phone ?? null
      }
      if (!savedPhone) return

      supabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('phone', savedPhone)
        .maybeSingle()
        .then(({ data }) => {
          if (data) router.replace(`/session/${sessionId}?already=1`)
        })
    } catch { /* ignore storage / parse errors */ }
  }, [])

  useEffect(() => {
    if (joinDest) router.push(joinDest)
  }, [joinDest])

  useEffect(() => {
    if (step === 'payment' && !clientSecret) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('step')
      router.replace(`${pathname}?${params}`)
    }
  }, [step, clientSecret])

  function goToPayment() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('step', 'payment')
    router.push(`${pathname}?${params}`)
  }

  function goToDetails() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('step')
    router.push(`${pathname}?${params}`)
  }

  async function initSetupIntent() {
    if (clientSecret) { goToPayment(); return }

    setLoadingSetup(true)
    setSetupError('')
    const res = await fetch('/api/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSetupError(data.error ?? 'Failed to initialise payment')
      setLoadingSetup(false)
      return
    }
    setClientSecret(data.clientSecret)
    setCustomerId(data.customerId)
    setLoadingSetup(false)
    goToPayment()
  }

  async function handleDetailsContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    sessionStorage.setItem('join_details', JSON.stringify({ name: name.trim(), phone: phone.trim() }))
    await initSetupIntent()
  }

  function handleJoinSuccess(dest: string) {
    if (!isLoggedIn) {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ name, phone })) } catch { /* ignore */ }
    }
    setJoinDest(dest)
  }

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#C6F135',
      colorBackground: '#161616',
      colorText: '#F7F4EE',
      colorDanger: '#FF4444',
      fontFamily: "'Archivo', sans-serif",
      borderRadius: '8px',
    },
  }

  const gridFilledCount = isOrganiser
    ? Math.max(0, existingPlayerCount - 1)
    : existingPlayerCount

  const startTime = sliceTime(slot.start_time)
  const endTime = sliceTime(slot.end_time)

  if (isOrganiser && step === 'details' && loadingSetup) {
    return (
      <div
        style={{
          maxWidth: '460px',
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

  /* ------------------------------------------------------------------ */
  /* Inline player token for join form grid                              */
  /* ------------------------------------------------------------------ */
  function renderSpot(i: number) {
    const filled = i < gridFilledCount
    const isYouSlot = i === gridFilledCount

    return (
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
          background: isYouSlot
            ? 'var(--green)'
            : filled
            ? 'rgba(198,241,53,0.1)'
            : 'rgba(255,255,255,0.02)',
          border: isYouSlot
            ? 'none'
            : filled
            ? '1px solid rgba(198,241,53,0.28)'
            : '1px dashed rgba(255,255,255,0.08)',
          boxShadow: isYouSlot
            ? '0 0 20px rgba(198,241,53,0.25)'
            : filled
            ? '0 0 14px rgba(198,241,53,0.08)'
            : 'none',
        }}
      >
        {/* Jersey number */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '6px',
            fontSize: '7px',
            fontWeight: 800,
            fontFamily: "'Archivo Black', sans-serif",
            color: isYouSlot
              ? 'rgba(0,0,0,0.35)'
              : filled
              ? 'rgba(198,241,53,0.4)'
              : 'rgba(255,255,255,0.07)',
            lineHeight: 1,
          }}
        >
          {i + 1}
        </div>

        {/* Avatar circle */}
        <div
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: isYouSlot
              ? 'rgba(0,0,0,0.25)'
              : filled
              ? 'var(--green)'
              : 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 800,
            color: isYouSlot ? 'var(--black)' : filled ? 'var(--black)' : 'transparent',
            fontFamily: "'Archivo Black', sans-serif",
          }}
        >
          {isYouSlot ? '' : filled ? '✓' : ''}
        </div>

        {/* Label */}
        <div
          style={{
            fontSize: '7px',
            fontWeight: 700,
            color: isYouSlot ? 'var(--black)' : filled ? 'var(--green)' : 'rgba(255,255,255,0.12)',
            textAlign: 'center',
            lineHeight: 1,
          }}
        >
          {isYouSlot ? 'You' : filled ? '' : `+${i - gridFilledCount + 1}`}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {isOrganiser ? (
        <>
          <div
            className="anim-fade-up"
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '28px',
              letterSpacing: '-0.035em',
              marginBottom: '0.35rem',
              lineHeight: 0.95,
            }}
          >
            You&apos;re in — now add your mates
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1.1rem', fontWeight: 500 }}>
            Add your card details below.{' '}
            <strong style={{ color: 'var(--text)' }}>Nothing is charged now</strong> — only when all 10 players join.
          </div>
          <div
            className="anim-fade-up d-100"
            style={{
              background: 'rgba(198,241,53,0.06)',
              border: '1px solid rgba(198,241,53,0.22)',
              borderRadius: '10px',
              padding: '0.9rem 1.1rem',
              marginBottom: '1.35rem',
              fontSize: '14px',
              color: 'var(--green)',
              fontWeight: 600,
            }}
          >
            🎉 Game created! Once you&apos;re set up, share the link to fill your team.
          </div>
        </>
      ) : (
        <>
          <div
            className="anim-fade-up"
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '28px',
              letterSpacing: '-0.035em',
              marginBottom: '0.35rem',
              lineHeight: 0.95,
            }}
          >
            Join the game
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1.35rem', fontWeight: 500 }}>
            <strong style={{ color: 'var(--text)' }}>Nothing is charged now.</strong> Your card is only charged when all 10 players join.
          </div>
        </>
      )}

      {/* Session summary */}
      <div
        className="anim-fade-up d-100"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.35rem',
          marginBottom: '1.35rem',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            color: 'var(--muted)',
            marginBottom: '4px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Globe Football Pitch · Bethnal Green
        </div>
        <div
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: '24px',
            letterSpacing: '-0.04em',
            marginBottom: '2px',
            lineHeight: 1,
          }}
        >
          {startTime} – {endTime}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.35rem', fontWeight: 500 }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>

        {/* Team grid — 2 rows of 5 */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
            {Array.from({ length: 5 }, (_, i) => renderSpot(i))}
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

          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: 5 }, (_, i) => renderSpot(i + 5))}
          </div>
        </div>

        {/* Segmented bar */}
        <div className="seg-bar" style={{ marginBottom: '8px' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const filled = i < existingPlayerCount
            const isAmber = existingPlayerCount >= 7 && existingPlayerCount < 10
            return (
              <div
                key={i}
                className={`seg-bar-seg ${filled ? (isAmber ? 'lit-amber' : 'lit-green') : 'unlit'}`}
                style={{ transitionDelay: `${i * 25}ms` }}
              />
            )
          })}
        </div>

        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', fontWeight: 500 }}>
          <strong style={{ color: 'var(--text)' }}>{existingPlayerCount}/10 players</strong>
          {existingPlayerCount === 9
            ? ' — just 1 more to confirm!'
            : ` — ${10 - existingPlayerCount} more needed`}
        </div>
      </div>

      {/* Details step */}
      {step === 'details' && (
        <form
          className="anim-fade-up d-150"
          onSubmit={handleDetailsContinue}
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

          {setupError && (
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
              {setupError}
            </div>
          )}

          <button
            type="submit"
            disabled={loadingSetup || !name.trim() || !phone.trim()}
            className={!loadingSetup && name.trim() && phone.trim() ? 'btn-g' : ''}
            style={{
              width: '100%',
              padding: '0.95rem',
              fontSize: '15px',
              borderRadius: '10px',
              border: 'none',
              cursor: loadingSetup || !name.trim() || !phone.trim() ? 'not-allowed' : 'pointer',
              background:
                loadingSetup || !name.trim() || !phone.trim()
                  ? 'var(--surface2)'
                  : 'var(--green)',
              color:
                loadingSetup || !name.trim() || !phone.trim()
                  ? 'var(--muted)'
                  : 'var(--black)',
              fontFamily: "'Archivo Black', sans-serif",
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginTop: '4px',
              transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
            }}
          >
            {loadingSetup ? 'Checking...' : 'Continue to payment →'}
          </button>
        </form>
      )}

      {/* Payment step */}
      {step === 'payment' && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <PaymentStep
            slot={slot}
            sessionId={sessionId}
            isOrganiser={isOrganiser}
            clientSecret={clientSecret}
            customerId={customerId}
            name={name}
            phone={phone}
            existingPlayerCount={existingPlayerCount}
            hasRival={hasRival}
            onBack={goToDetails}
            onSuccess={handleJoinSuccess}
          />
        </Elements>
      )}
    </div>
  )
}
