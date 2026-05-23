'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createClient } from '@/lib/supabase/client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

/** Strip seconds off a DB time string like "18:30:00" → "18:30" */
function sliceTime(t: string): string {
  return t ? t.slice(0, 5) : t
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
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
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

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/session/${sessionId ?? 'new'}` },
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment setup failed')
      setLoading(false)
      return
    }

    if (!setupIntent?.payment_method) {
      setError('Could not save payment method')
      setLoading(false)
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
        paymentMethodId: setupIntent.payment_method,
        customerId, // Pass the pre-created customer so join route doesn't create a duplicate
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to join session')
      setLoading(false)
      return
    }

    // Clear saved details after successful join
    sessionStorage.removeItem('join_details')

    const dest = isOrganiser
      ? `/session/${data.sessionId}?created=1`
      : `/session/${data.sessionId}?joined=1`
    router.push(dest)
  }

  return (
    <form onSubmit={handleSubmit}>
      {hasRival && (
        <div style={{ background: 'rgba(255,184,0,0.07)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '14px', color: 'var(--amber)', display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: 1.5 }}>
          ⚡ Another group is also trying to fill this slot. First to 10 gets it.
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', background: 'rgba(200,244,0,0.05)', border: '1px solid rgba(200,244,0,0.12)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '14px', color: 'rgba(200,244,0,0.75)', lineHeight: 1.5 }}>
        🔒 <span><strong style={{ color: 'var(--green)' }}>Nothing is charged now.</strong> Your card is only charged when the 10th player joins. If the session doesn&apos;t fill, you pay nothing.</span>
      </div>

      {/* Cost breakdown — revealed here at checkout */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
        {[
          { label: `Pitch hire split (£${slot.price} ÷ 10)`, amount: `£${pitchPerPlayer.toFixed(2)}` },
          { label: 'Booking fee', amount: '50p' },
          { label: 'Payment handling', amount: '30p' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--muted)', marginBottom: '7px' }}>
            <span>{row.label}</span><span>{row.amount}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)', fontWeight: 800, fontSize: '15px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <span>Total if confirmed</span>
          <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '20px', color: 'var(--green)', letterSpacing: '-0.3px' }}>£{totalPerPlayer}</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
          You&apos;ll get a text the moment it&apos;s confirmed. Less than a coffee.
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>Payment method</label>
        <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }} />
      </div>

      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '13px', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={loading || !stripe} style={{
        width: '100%', padding: '0.85rem', fontSize: '15px', borderRadius: '10px', border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: loading ? 'var(--surface2)' : 'var(--green)',
        color: loading ? 'var(--muted)' : 'var(--black)',
        fontFamily: "'Archivo', sans-serif", fontWeight: 600, transition: 'all 0.15s', marginBottom: '8px',
      }}>
        {loading ? 'Processing…' : `Join — only £${totalPerPlayer} if confirmed`}
      </button>
      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', marginBottom: '1rem' }}>
        🔒 Secured by Stripe · Card only charged when session is full
      </div>
      <button type="button" onClick={onBack} style={{
        width: '100%', padding: '0.65rem', fontSize: '14px', borderRadius: '10px',
        border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent',
        color: 'var(--muted)', fontFamily: "'Archivo', sans-serif", fontWeight: 500,
      }}>
        ← Back
      </button>
    </form>
  )
}

function AuthStep({
  name,
  phone,
  setupError,
  loadingSetup,
  onAuth,
  onBack,
}: {
  name: string
  phone: string
  setupError: string
  loadingSetup: boolean
  onAuth: () => void
  onBack: () => void
}) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    if (mode === 'signup') {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, phone } },
      })
      if (authError) { setError(authError.message); setLoading(false); return }
      if (!data.session) {
        setError('Account created but sign-in failed — email confirmation may be enabled. Please contact support.')
        setLoading(false)
        return
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(authError.message); setLoading(false); return }
    }

    setLoading(false)
    onAuth()
  }

  const busy = loading || loadingSetup

  return (
    <div>
      <div style={{ fontSize: '18px', fontFamily: "'Archivo Black', sans-serif", letterSpacing: '-0.5px', marginBottom: '0.25rem' }}>
        Almost there
      </div>
      <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '1.25rem' }}>
        {mode === 'signup' ? 'Create a free account to save your booking.' : 'Log in to continue to payment.'}
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: '8px', padding: '3px', marginBottom: '1rem' }}>
        {(['signup', 'login'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError('') }}
            style={{
              flex: 1, padding: '0.45rem', borderRadius: '6px', border: 'none',
              fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', transition: 'all 0.15s',
              background: mode === m ? 'var(--surface)' : 'transparent',
              color: mode === m ? 'var(--text)' : 'var(--muted)',
            }}
          >
            {m === 'signup' ? 'Create account' : 'Log in'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <div style={{ marginBottom: '4px' }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
            required minLength={mode === 'signup' ? 8 : undefined} style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {(error || setupError) && (
          <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px', color: 'var(--red)' }}>
            {error || setupError}
          </div>
        )}

        <button type="submit" disabled={busy || !email.trim() || !password.trim()} style={{
          width: '100%', padding: '0.85rem', fontSize: '15px', borderRadius: '10px', border: 'none',
          cursor: busy || !email.trim() || !password.trim() ? 'not-allowed' : 'pointer',
          background: busy || !email.trim() || !password.trim() ? 'var(--surface2)' : 'var(--green)',
          color: busy || !email.trim() || !password.trim() ? 'var(--muted)' : 'var(--black)',
          fontFamily: "'Archivo', sans-serif", fontWeight: 600, marginTop: '4px',
        }}>
          {busy ? 'Please wait…' : 'Continue to payment →'}
        </button>
      </form>

      <button type="button" onClick={onBack} style={{
        width: '100%', padding: '0.65rem', fontSize: '14px', borderRadius: '10px', marginTop: '8px',
        border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent',
        color: 'var(--muted)', fontFamily: "'Archivo', sans-serif", fontWeight: 500,
      }}>
        ← Back
      </button>
    </div>
  )
}

export default function JoinForm({ slot, isOrganiser, sessionId, existingPlayerCount = 0, hasRival = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Track join step in URL so browser back button works
  const stepParam = searchParams.get('step')
  const step: 'details' | 'auth' | 'payment' =
    stepParam === 'payment' ? 'payment' : stepParam === 'auth' ? 'auth' : 'details'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [customerId, setCustomerId] = useState('')   // persisted from setup-intent
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [setupError, setSetupError] = useState('')

  // Restore name/phone from sessionStorage if user navigated back
  useEffect(() => {
    const saved = sessionStorage.getItem('join_details')
    if (saved) {
      try {
        const { name: n, phone: p } = JSON.parse(saved)
        if (n) setName(n)
        if (p) setPhone(p)
      } catch { /* ignore malformed data */ }
    }
  }, [])

  // If step=payment but no clientSecret (e.g. hard refresh), go back to details
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

  function goToAuth() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('step', 'auth')
    router.push(`${pathname}?${params}`)
  }

  function goToDetails() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('step')
    router.push(`${pathname}?${params}`)
  }

  async function initSetupIntent() {
    // Reuse existing setup intent if we already have one
    if (clientSecret) {
      goToPayment()
      return
    }

    setLoadingSetup(true)
    setSetupError('')
    const res = await fetch('/api/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSetupError(data.error ?? 'Failed to initialize payment')
      setLoadingSetup(false)
      return
    }
    setClientSecret(data.clientSecret)
    setCustomerId(data.customerId)  // Store for the join API call
    setLoadingSetup(false)
    goToPayment()
  }

  async function handleDetailsContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setLoadingSetup(true)
    setSetupError('')

    // Save to sessionStorage for back-button restore
    sessionStorage.setItem('join_details', JSON.stringify({ name, phone }))

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setLoadingSetup(false)

    if (user) {
      await initSetupIntent()
    } else {
      goToAuth()
    }
  }

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#C8F400',
      colorBackground: '#191919',
      colorText: '#F7F4EE',
      colorDanger: '#FF4444',
      fontFamily: "'Archivo', sans-serif",
      borderRadius: '8px',
    },
  }

  // Player grid: filled = dot, next open = "you", rest = empty
  function fmtPlayer(idx: number) {
    return idx < existingPlayerCount ? '●' : `+${idx - existingPlayerCount + 1}`
  }

  const startTime = sliceTime(slot.start_time)
  const endTime = sliceTime(slot.end_time)

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {isOrganiser ? (
        <>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
            Secure your spot
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1rem' }}>
            Game created! Now add your payment details to lock in your place.
          </div>
          <div style={{
            background: 'rgba(200,244,0,0.06)', border: '1px solid rgba(200,244,0,0.2)',
            borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
            fontSize: '14px', color: 'var(--green)',
          }}>
            🎉 You&apos;re the organiser — share the link after joining to fill the team.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
            Join the session
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1.25rem' }}>
            Your card won&apos;t be charged until all 10 players are in.
          </div>
        </>
      )}

      {/* Session summary */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Globe Football Pitch · Bethnal Green
        </div>
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', letterSpacing: '-0.5px', marginBottom: '2px' }}>
          {startTime} – {endTime}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '1rem' }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>

        {/* Always show all 10 player slots */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '0.75rem' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const filled = i < existingPlayerCount
            const isYouSlot = i === existingPlayerCount // the next open slot = "you"
            return (
              <div key={i} style={{
                height: '36px', borderRadius: '6px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '11px', fontWeight: 700,
                background: isYouSlot ? 'var(--green)' : filled ? 'rgba(200,244,0,0.12)' : 'var(--surface2)',
                border: filled && !isYouSlot ? '1px solid rgba(200,244,0,0.25)' : isYouSlot ? 'none' : '1px dashed rgba(255,255,255,0.07)',
                color: isYouSlot ? 'var(--black)' : filled ? 'var(--green)' : 'var(--muted)',
              }}>
                {isYouSlot ? 'You' : fmtPlayer(i)}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'center' }}>
          <strong style={{ color: 'var(--text)' }}>{existingPlayerCount}/10 players</strong>
          {existingPlayerCount === 9 ? ' — just 1 more to confirm!' : ` — ${10 - existingPlayerCount} more needed`}
        </div>
      </div>

      {step === 'details' ? (
        <form onSubmit={handleDetailsContinue} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div style={{ marginBottom: '4px' }}>
            <label style={labelStyle}>Phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="+44 7700 000000" required style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>

          {setupError && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px', color: 'var(--red)' }}>
              {setupError}
            </div>
          )}

          <button type="submit" disabled={loadingSetup || !name.trim() || !phone.trim()} style={{
            width: '100%', padding: '0.85rem', fontSize: '15px', borderRadius: '10px', border: 'none',
            cursor: loadingSetup || !name.trim() || !phone.trim() ? 'not-allowed' : 'pointer',
            background: loadingSetup || !name.trim() || !phone.trim() ? 'var(--surface2)' : 'var(--green)',
            color: loadingSetup || !name.trim() || !phone.trim() ? 'var(--muted)' : 'var(--black)',
            fontFamily: "'Archivo', sans-serif", fontWeight: 600, marginTop: '4px',
          }}>
            {loadingSetup ? 'Checking…' : 'Continue →'}
          </button>
        </form>
      ) : step === 'auth' ? (
        <AuthStep
          name={name}
          phone={phone}
          setupError={setupError}
          loadingSetup={loadingSetup}
          onAuth={initSetupIntent}
          onBack={goToDetails}
        />
      ) : clientSecret ? (
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
          />
        </Elements>
      ) : null}
    </div>
  )
}
