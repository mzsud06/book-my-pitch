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
  /** When true the user is logged in — skip the "save details" prompt entirely. */
  isLoggedIn?: boolean
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
  transition: 'border-color 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', display: 'block',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
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
        // Log the full Stripe error to the console so it's visible in DevTools.
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

      // setupIntent.payment_method may be a full PaymentMethod object in newer
      // Stripe.js versions (not just an ID string) — normalise to the ID.
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
      // Always reset loading — guards against unexpected throws from Stripe or
      // the fetch so the button never stays permanently stuck on "Processing…".
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {hasRival && (
        <div style={{
          background: 'rgba(255,184,0,0.07)', border: '1px solid rgba(255,184,0,0.2)',
          borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
          fontSize: '14px', color: 'var(--amber)', display: 'flex', gap: '8px',
          alignItems: 'flex-start', lineHeight: 1.5,
        }}>
          ⚡ Another group is also trying to fill this slot. First to 10 gets it.
        </div>
      )}

      <div style={{
        display: 'flex', gap: '8px', background: 'rgba(200,244,0,0.05)',
        border: '1px solid rgba(200,244,0,0.12)', borderRadius: '8px',
        padding: '0.85rem 1rem', marginBottom: '1.25rem',
        fontSize: '14px', color: 'rgba(200,244,0,0.75)', lineHeight: 1.5,
      }}>
        🔒 <span><strong style={{ color: 'var(--green)' }}>Nothing is charged now.</strong> Your card is only charged when the 10th player joins. If the session doesn&apos;t fill, you pay nothing.</span>
      </div>

      {/* Cost breakdown */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(200,244,0,0.03) 0%, var(--surface) 100%)',
        border: '1px solid rgba(200,244,0,0.12)',
        borderRadius: '12px', padding: '1.25rem 1.4rem', marginBottom: '1.25rem',
      }}>
        {[
          { label: `Pitch hire split (£${slot.price} / 10)`, amount: `£${pitchPerPlayer.toFixed(2)}` },
          { label: 'Booking fee', amount: '50p' },
          { label: 'Payment handling', amount: '30p' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '13px', color: 'var(--muted)', marginBottom: '8px',
          }}>
            <span>{row.label}</span><span style={{ fontWeight: 700 }}>{row.amount}</span>
          </div>
        ))}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          color: 'var(--text)', fontWeight: 800, fontSize: '15px',
          marginTop: '8px', paddingTop: '10px', borderTop: '1px solid rgba(200,244,0,0.12)',
        }}>
          <span>Total if confirmed</span>
          <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', color: 'var(--green)', letterSpacing: '-0.5px' }}>
            £{totalPerPlayer}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '0.6rem', lineHeight: 1.5 }}>
          You&apos;ll get a text the moment it&apos;s confirmed. Less than a coffee.
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>Payment method</label>
        <PaymentElement options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
        }} />
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)',
          borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem',
          fontSize: '13px', color: 'var(--red)',
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className={!loading && stripe ? 'btn-g' : ''}
        style={{
          width: '100%', padding: '0.85rem', fontSize: '15px', borderRadius: '10px', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--surface2)' : 'var(--green)',
          color: loading ? 'var(--muted)' : 'var(--black)',
          fontFamily: "'Archivo', sans-serif", fontWeight: 700,
          transition: 'background-color 0.15s ease, color 0.15s ease, transform 0.16s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.16s ease',
          marginBottom: '8px',
        }}
      >
        {loading ? 'Processing...' : `Join — only £${totalPerPlayer} if confirmed`}
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

// ---------------------------------------------------------------------------
// JoinForm (main export)
// ---------------------------------------------------------------------------
export default function JoinForm({ slot, isOrganiser, sessionId, existingPlayerCount = 0, hasRival = false, isLoggedIn = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Only two steps now: details → payment (no auth step)
  const stepParam = searchParams.get('step')
  const step: 'details' | 'payment' = stepParam === 'payment' ? 'payment' : 'details'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [setupError, setSetupError] = useState('')

  // Track whether we've already auto-advanced the organiser past the details step.
  // Prevents the effect from firing more than once if name/phone state updates again.
  const didAutoAdvance = useRef(false)

  // Destination set after a successful join (triggers navigation)
  const [joinDest, setJoinDest] = useState<string | null>(null)

  // Pre-fill from sessionStorage (back-nav restore for organiser) or localStorage (returning player)
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

  // Organiser already entered their name + phone on the create page.
  // Once those values land in state (via the pre-fill effect above), skip the
  // details form entirely and go straight to payment so they don't see the
  // fields a second time.
  useEffect(() => {
    if (!isOrganiser || didAutoAdvance.current || !name || !phone) return
    didAutoAdvance.current = true
    initSetupIntent()
  // initSetupIntent reads name/phone from the surrounding closure; this effect
  // re-runs whenever those values change, which is exactly what we want.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, isOrganiser])

  // Phone-based duplicate check for guests (logged-in users are caught server-side).
  // Reads the saved phone from storage and queries the players table; if found,
  // redirects to the session page before the user can attempt payment again.
  useEffect(() => {
    if (!sessionId || isLoggedIn) return // logged-in case handled server-side
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

  // Navigate once joinDest is ready (after localStorage write completes)
  useEffect(() => {
    if (joinDest) router.push(joinDest)
  }, [joinDest])

  // If step=payment but no clientSecret (e.g. hard refresh), fall back to details
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

  // Called by PaymentStep on successful join.
  // Always persists the phone (and name) to localStorage for guests so they can
  // return to their session page — the session page does a client-side phone
  // check and would show a "private" message if localStorage were empty.
  function handleJoinSuccess(dest: string) {
    if (!isLoggedIn) {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ name, phone })) } catch { /* ignore */ }
    }
    setJoinDest(dest)
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

  // When the organiser is joining, their slot (index 0) is already reflected in
  // existingPlayerCount because organiser_name is set on the session before they
  // pay — but it is *their* spot, so subtract 1 so the grid shows "You" there
  // instead of a dot.
  const gridFilledCount = isOrganiser
    ? Math.max(0, existingPlayerCount - 1)
    : existingPlayerCount

  const startTime = sliceTime(slot.start_time)
  const endTime = sliceTime(slot.end_time)

  // ---------------------------------------------------------------------------
  // Main join form
  // ---------------------------------------------------------------------------

  // While the organiser auto-advances to the payment step, show a minimal
  // spinner so there's no flash of the name/phone fields they already filled in.
  if (isOrganiser && step === 'details' && loadingSetup) {
    return (
      <div style={{ maxWidth: '460px', margin: '4rem auto', padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '15px' }}>
        Setting up payment…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {isOrganiser ? (
        <>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
            You&apos;re in — now add your mates
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1rem' }}>
            Add your card details below. <strong style={{ color: 'var(--text)' }}>Nothing is charged now</strong> — only when all 10 players join.
          </div>
          <div style={{
            background: 'rgba(200,244,0,0.06)', border: '1px solid rgba(200,244,0,0.2)',
            borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
            fontSize: '14px', color: 'var(--green)',
          }}>
            🎉 Game created! Once you&apos;re set up, share the link to fill your team.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
            Join the game
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '1.25rem' }}>
            <strong style={{ color: 'var(--text)' }}>Nothing is charged now.</strong> Your card is only charged when all 10 players join.
          </div>
        </>
      )}

      {/* Session summary */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Globe Football Pitch · Bethnal Green
        </div>
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', letterSpacing: '-0.5px', marginBottom: '2px' }}>
          {startTime} – {endTime}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '1rem' }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '0.75rem' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const filled = i < gridFilledCount
            const isYouSlot = i === gridFilledCount
            return (
              <div
                key={i}
                className={filled || isYouSlot ? 'anim-spot-in' : ''}
                style={{
                  height: '38px', borderRadius: '6px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '11px', fontWeight: 700,
                  background: isYouSlot ? 'var(--green)' : filled ? 'rgba(200,244,0,0.12)' : 'var(--surface2)',
                  border: filled && !isYouSlot ? '1px solid rgba(200,244,0,0.3)' : isYouSlot ? 'none' : '1px dashed rgba(255,255,255,0.07)',
                  color: isYouSlot ? 'var(--black)' : filled ? 'var(--green)' : 'var(--muted)',
                  animationDelay: `${i * 45}ms`,
                }}
              >
                {isYouSlot ? 'You' : filled ? '✓' : `+${i - gridFilledCount + 1}`}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'center' }}>
          <strong style={{ color: 'var(--text)' }}>{existingPlayerCount}/10 players</strong>
          {existingPlayerCount === 9 ? ' — just 1 more to confirm!' : ` — ${10 - existingPlayerCount} more needed`}
        </div>
      </div>

      {/* Details step */}
      {step === 'details' && (
        <form onSubmit={handleDetailsContinue} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Your name</label>
            <input
              className="field-input"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name" required style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '4px' }}>
            <label style={labelStyle}>Phone number</label>
            <input
              className="field-input"
              value={phone} onChange={e => setPhone(e.target.value)}
              type="tel" placeholder="+44 7700 000000" required style={inputStyle}
            />
          </div>

          {setupError && (
            <div style={{
              background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px', color: 'var(--red)',
            }}>
              {setupError}
            </div>
          )}

          <button
            type="submit"
            disabled={loadingSetup || !name.trim() || !phone.trim()}
            className={!loadingSetup && name.trim() && phone.trim() ? 'btn-g' : ''}
            style={{
              width: '100%', padding: '0.85rem', fontSize: '15px', borderRadius: '10px', border: 'none',
              cursor: loadingSetup || !name.trim() || !phone.trim() ? 'not-allowed' : 'pointer',
              background: loadingSetup || !name.trim() || !phone.trim() ? 'var(--surface2)' : 'var(--green)',
              color: loadingSetup || !name.trim() || !phone.trim() ? 'var(--muted)' : 'var(--black)',
              fontFamily: "'Archivo', sans-serif", fontWeight: 700, marginTop: '4px',
              transition: 'background-color 0.15s ease, color 0.15s ease, transform 0.16s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.16s ease',
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
