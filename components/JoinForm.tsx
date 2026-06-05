'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createClient } from '@/lib/supabase/client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const LS_KEY = 'bmp_player_details'

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

function parsePhone(full: string): { countryCode: string; localNumber: string } {
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  const match = sorted.find(({ code }) => full.startsWith(code))
  if (match) return { countryCode: match.code, localNumber: full.slice(match.code.length) }
  return { countryCode: '+44', localNumber: full.replace(/[^0-9]/g, '') }
}

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
          Another group is also trying to fill this slot. First to 10 gets it.
        </div>
      )}

      {/* Nothing charged callout */}
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
          <strong style={{ color: 'var(--green)' }}>Nothing is charged now.</strong> Your card is only charged when the 10th player joins. If the session doesn&apos;t fill, you pay nothing.
        </span>
      </div>

      {/* Cost breakdown */}
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
              fontFamily: "'Archivo Black', sans-serif",
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
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className={!loading && stripe ? 'btn-g' : ''}
        style={{
          width: '100%',
          padding: '1rem',
          fontSize: '16px',
          borderRadius: '12px',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--surface2)' : 'var(--green)',
          color: loading ? 'var(--muted)' : 'var(--black)',
          fontFamily: "'Archivo Black', sans-serif",
          fontWeight: 900,
          letterSpacing: '-0.025em',
          transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
          marginBottom: '8px',
          lineHeight: 1,
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
        Secured by Stripe · Card only charged when session is full
      </div>

      <button
        type="button"
        onClick={onBack}
        className="btn-ghost"
        style={{
          width: '100%',
          padding: '0.8rem',
          fontSize: '14px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          background: 'transparent',
          color: 'var(--muted)',
          fontFamily: "'Archivo', sans-serif",
          fontWeight: 600,
          transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.12s ease',
          lineHeight: 1,
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
  const [countryCode, setCountryCode] = useState('+44')
  const [localNumber, setLocalNumber] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const didAutoAdvance = useRef(false)
  const [joinDest, setJoinDest] = useState<string | null>(null)

  useEffect(() => {
    const ss = sessionStorage.getItem('join_details')
    if (ss) {
      try {
        const { name: n, phone: p } = JSON.parse(ss)
        if (n) setName(n)
        if (p) {
          const parsed = parsePhone(p)
          setCountryCode(parsed.countryCode)
          setLocalNumber(parsed.localNumber)
          setPhone(p)
        }
        return
      } catch { /* ignore */ }
    }
    try {
      const ls = localStorage.getItem(LS_KEY)
      if (ls) {
        const { name: n, phone: p } = JSON.parse(ls)
        if (n) setName(n)
        if (p) {
          const parsed = parsePhone(p)
          setCountryCode(parsed.countryCode)
          setLocalNumber(parsed.localNumber)
          setPhone(p)
        }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!isOrganiser || didAutoAdvance.current || !name || !localNumber) return
    didAutoAdvance.current = true
    initSetupIntent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, localNumber, isOrganiser])

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
    } catch { /* ignore */ }
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
    let valid = true
    if (!name.trim() || !/^[A-Za-z ]+$/.test(name.trim())) {
      setNameError('Please enter a valid name')
      valid = false
    }
    if (!localNumber.trim() || !/^[0-9]{1,15}$/.test(localNumber.trim())) {
      setPhoneError('Please enter a valid phone number')
      valid = false
    }
    if (!valid) return
    sessionStorage.setItem('join_details', JSON.stringify({ name: name.trim(), phone: phone.trim() }))
    await initSetupIntent()
  }

  function handleJoinSuccess(dest: string) {
    if (!isLoggedIn) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ name, phone }))
        const sessionId = dest.split('/session/')[1]?.split('?')[0]
        if (sessionId) {
          const raw = JSON.parse(localStorage.getItem('bmp_my_sessions') ?? '[]')
          const existing = Array.isArray(raw) ? raw : []
          localStorage.setItem('bmp_my_sessions', JSON.stringify([
            { sessionId, name, isOrganiser, joinedAt: new Date().toISOString() },
            ...existing.filter((b: { sessionId: string }) => b.sessionId !== sessionId),
          ]))
        }
      } catch { /* ignore */ }
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
      borderRadius: '10px',
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

  function renderSpot(i: number) {
    const filled = i < gridFilledCount
    const isYouSlot = i === gridFilledCount

    return (
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
          background: isYouSlot
            ? 'var(--green)'
            : filled
            ? 'rgba(198,241,53,0.09)'
            : 'rgba(255,255,255,0.02)',
          border: isYouSlot
            ? 'none'
            : filled
            ? '1px solid rgba(198,241,53,0.28)'
            : '1px dashed rgba(255,255,255,0.07)',
          boxShadow: isYouSlot
            ? '0 0 22px rgba(198,241,53,0.25)'
            : filled
            ? '0 0 14px rgba(198,241,53,0.07)'
            : 'none',
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
            color: isYouSlot
              ? 'rgba(0,0,0,0.3)'
              : filled
              ? 'rgba(198,241,53,0.4)'
              : 'rgba(255,255,255,0.06)',
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
            background: isYouSlot
              ? 'rgba(0,0,0,0.2)'
              : filled
              ? 'var(--green)'
              : 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 900,
            color: isYouSlot ? 'var(--black)' : filled ? 'var(--black)' : 'transparent',
            fontFamily: "'Archivo Black', sans-serif",
          }}
        >
          {isYouSlot ? '' : filled ? '✓' : ''}
        </div>

        <div
          style={{
            fontSize: '7px',
            fontWeight: 700,
            color: isYouSlot ? 'var(--black)' : filled ? 'var(--green)' : 'rgba(255,255,255,0.1)',
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
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      {isOrganiser ? (
        <>
          <div
            className="anim-fade-up"
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 'clamp(24px, 5vw, 30px)',
              letterSpacing: '-0.04em',
              marginBottom: '0.4rem',
              lineHeight: 0.92,
            }}
          >
            You&apos;re in — now add your mates
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1.1rem', fontWeight: 500, lineHeight: 1.6 }}>
            Add your card details below.{' '}
            <strong style={{ color: 'var(--text)' }}>Nothing is charged now</strong> — only when all 10 players join.
          </div>
          <div
            className="anim-fade-up d-100"
            style={{
              background: 'rgba(198,241,53,0.05)',
              border: '1px solid rgba(198,241,53,0.22)',
              borderRadius: '12px',
              padding: '1rem 1.2rem',
              marginBottom: '1.5rem',
              fontSize: '14px',
              color: 'var(--green)',
              fontWeight: 700,
            }}
          >
            Game created! Once you&apos;re set up, share the link to fill your team.
          </div>
        </>
      ) : (
        <>
          <div
            className="anim-fade-up"
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 'clamp(24px, 5vw, 30px)',
              letterSpacing: '-0.04em',
              marginBottom: '0.4rem',
              lineHeight: 0.92,
            }}
          >
            Join the game
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1.5rem', fontWeight: 500, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Nothing is charged now.</strong> Your card is only charged when all 10 players join.
          </div>
        </>
      )}

      {/* Session summary */}
      <div
        className="anim-fade-up d-100"
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
            fontSize: '10px',
            color: 'var(--muted)',
            marginBottom: '5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Globe Football Pitch · Bethnal Green
        </div>
        <div
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: '26px',
            letterSpacing: '-0.04em',
            marginBottom: '3px',
            lineHeight: 1,
          }}
        >
          {startTime} – {endTime}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem', fontWeight: 500 }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>

        {/* Team grid */}
        <div style={{ marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
            {Array.from({ length: 5 }, (_, i) => renderSpot(i))}
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
              5-a-side
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: 5 }, (_, i) => renderSpot(i + 5))}
          </div>
        </div>

        {/* Segmented bar */}
        <div className="seg-bar" style={{ marginBottom: '10px' }}>
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

        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', fontWeight: 600 }}>
          <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{existingPlayerCount}/10 players</strong>
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

          {setupError && (
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
              {setupError}
            </div>
          )}

          <button
            type="submit"
            disabled={loadingSetup || !name.trim() || !localNumber.trim() || !!nameError || !!phoneError}
            className={!loadingSetup && name.trim() && localNumber.trim() && !nameError && !phoneError ? 'btn-g' : ''}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '16px',
              borderRadius: '12px',
              border: 'none',
              cursor: loadingSetup || !name.trim() || !localNumber.trim() || nameError || phoneError ? 'not-allowed' : 'pointer',
              background:
                loadingSetup || !name.trim() || !localNumber.trim() || nameError || phoneError
                  ? 'var(--surface2)'
                  : 'var(--green)',
              color:
                loadingSetup || !name.trim() || !localNumber.trim() || nameError || phoneError
                  ? 'var(--muted)'
                  : 'var(--black)',
              fontFamily: "'Archivo Black', sans-serif",
              fontWeight: 900,
              letterSpacing: '-0.025em',
              marginTop: '4px',
              transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
              lineHeight: 1,
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
