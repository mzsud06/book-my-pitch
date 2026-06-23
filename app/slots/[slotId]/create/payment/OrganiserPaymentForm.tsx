'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface SlotData {
  id: string
  date: string
  start_time: string
  end_time: string
  type: string
  price: number
  max_players: number
  venue: { name: string; address: string } | null
}

interface CreateDetails {
  name: string
  phone: string
  gameType: 'private' | 'looking_for_opposition' | 'open'
  teamName: string
}

interface Props {
  slot: SlotData
  challengeSessionId: string | null
  challengedTeamName: string | null
  challengedPlayerCount: number | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

// Module-level guard — persists across Strict Mode double-mounts unlike useRef.
let isConfirmingGlobal = false

function CardStep({
  slot,
  details,
  customerId,
  challengeSessionId,
  onConfirmError,
  parentDisabled,
}: {
  slot: SlotData
  details: CreateDetails
  customerId: string
  challengeSessionId: string | null
  // Called when stripe.confirmSetup fails — parent will fetch a fresh SetupIntent.
  onConfirmError: (message: string) => void
  // True while the parent is refreshing the SetupIntent; prevents double-submission.
  parentDisabled: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // submitError is for form-validation failures (intent still pristine, no refresh needed).
  const [submitError, setSubmitError] = useState('')

  const pitchPerPlayer = (slot.price / slot.max_players).toFixed(2)
  const total = (slot.price / slot.max_players + 0.50 + 0.30).toFixed(2)
  const isDisabled = loading || parentDisabled || !stripe

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log(`[CardStep] handleSubmit entered at ${new Date().toISOString()} | isConfirmingGlobal=${isConfirmingGlobal} | isDisabled=${isDisabled}`)
    if (isDisabled || !elements) return
    if (isConfirmingGlobal) {
      console.warn('[CardStep] handleSubmit: confirmSetup already in flight — ignoring duplicate call')
      return
    }
    isConfirmingGlobal = true
    setLoading(true)
    setSubmitError('')

    try {
      // elements.submit() validates the form and collects wallet data.
      // Required in Stripe.js v5+. A submitError means the intent is still in
      // requires_payment_method — no refresh needed, just show the message inline.
      console.log(`[CardStep] calling elements.submit() at ${new Date().toISOString()}`)
      const { error: elError } = await elements.submit()
      if (elError) {
        console.error('[CardStep] elements.submit error:', JSON.stringify(elError, Object.getOwnPropertyNames(elError)))
        setSubmitError(elError.message ?? 'Please check your card details.')
        return
      }

      console.log(`[CardStep] calling stripe.confirmSetup() at ${new Date().toISOString()}`)
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/slots/${slot.id}/create/payment${challengeSessionId ? `?challenge=${challengeSessionId}` : ''}`,
        },
      })
      console.log(`[CardStep] stripe.confirmSetup() returned at ${new Date().toISOString()} | error=${confirmError?.code ?? 'none'}`)

      if (confirmError) {
        // The SetupIntent may have moved to an unretryable state (e.g. setup_intent_unexpected_state).
        // Signal the parent to fetch a fresh SetupIntent so the next attempt uses a clean one.
        console.error('[CardStep] stripe.confirmSetup error:', JSON.stringify(confirmError, Object.getOwnPropertyNames(confirmError)))
        onConfirmError(confirmError.message ?? 'Card setup failed. Please try again.')
        return
      }

      const paymentMethodId =
        typeof setupIntent?.payment_method === 'string'
          ? setupIntent.payment_method
          : (setupIntent?.payment_method as { id: string } | null)?.id

      if (!paymentMethodId) {
        setSubmitError('Could not read payment method. Please try again.')
        return
      }

      // Create the session now that card is confirmed
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          name: details.name,
          phone: details.phone,
          teamName: details.gameType === 'looking_for_opposition' ? details.teamName : '',
          gameType: details.gameType,
          ...(challengeSessionId ? { matchedSessionId: challengeSessionId } : {}),
        }),
      })
      const sessionData = await sessionRes.json()

      if (!sessionRes.ok) {
        setSubmitError(sessionData.error ?? 'Failed to create game. Please try again.')
        return
      }

      // Insert organiser as the first player
      const joinRes = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          sessionId: sessionData.sessionId,
          isOrganiser: true,
          name: details.name,
          phone: details.phone,
          paymentMethodId,
          customerId,
        }),
      })
      const joinData = await joinRes.json()

      if (!joinRes.ok) {
        // Roll back the session row so no orphaned session exists without a player.
        fetch('/api/sessions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionData.sessionId }),
        }).catch(() => {})
        setSubmitError(joinData.error ?? 'Failed to join game. Please try again.')
        return
      }

      sessionStorage.removeItem('bmp_create_details')
      router.replace(`/session/${sessionData.sessionId}?created=1`)
    } finally {
      isConfirmingGlobal = false
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Cost breakdown */}
      <div
        style={{
          background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px',
          padding: '1.1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
          <span>Pitch hire split (£{slot.price} / {slot.max_players})</span>
          <span>£{pitchPerPlayer}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
          <span>Booking fee</span>
          <span>50p</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
          <span>Payment handling</span>
          <span>30p</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '14px',
            fontWeight: 800,
            color: 'var(--text)',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: '2px',
          }}
        >
          <span>Total if confirmed</span>
          <span style={{ color: 'var(--green)' }}>£{total}</span>
        </div>
      </div>

      {/* Prominent "not charged today" banner — sits directly above the card form */}
      <div
        style={{
          background: '#C6F135',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          color: '#000',
        }}
      >
        <div
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: '15px',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            lineHeight: 1.35,
          }}
        >
          🔒 You will NOT be charged today.
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px', lineHeight: 1.5, opacity: 0.75 }}>
          Your card is only charged once all players have joined and the game is confirmed.
        </div>
      </div>

      {/* Stripe card form */}
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
        }}
      />

      {submitError && (
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
          {submitError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          type="submit"
          disabled={isDisabled}
          className={!isDisabled ? 'btn-g' : ''}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '12px',
            border: 'none',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            background: isDisabled ? 'var(--surface2)' : 'var(--green)',
            color: isDisabled ? 'var(--muted)' : 'var(--black)',
            fontFamily: "'Archivo Black', sans-serif",
            fontWeight: 900,
            fontSize: '16px',
            letterSpacing: '-0.025em',
            marginTop: '4px',
            transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
            lineHeight: 1,
          }}
        >
          {loading ? 'Confirming your spot…' : parentDisabled ? 'Refreshing payment form…' : `Confirm your spot — only £${total} if confirmed`}
        </button>
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
          No charge until game is full.
        </div>
      </div>
    </form>
  )
}

export default function OrganiserPaymentForm({ slot, challengeSessionId, challengedTeamName, challengedPlayerCount }: Props) {
  const router = useRouter()
  const [details, setDetails] = useState<CreateDetails | null>(null)
  const [clientSecret, setClientSecret] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [initError, setInitError] = useState('')
  // setupKey increments on each fresh SetupIntent so <Elements> fully remounts.
  const [setupKey, setSetupKey] = useState(0)
  // formError survives <Elements> remounts — shown above the card form.
  const [formError, setFormError] = useState('')
  // True while fetching a replacement SetupIntent; disables the submit button.
  const [refreshing, setRefreshing] = useState(false)

  const typeLabel = slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'
  const startTime = slot.start_time.slice(0, 5)
  const endTime = slot.end_time.slice(0, 5)

  async function fetchSetupIntent(parsed: CreateDetails) {
    console.log(`[OrganiserPaymentForm] fetchSetupIntent called at ${new Date().toISOString()}`)
    const r = await fetch('/api/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: parsed.name, phone: parsed.phone, slotId: slot.id }),
    })
    const data = await r.json() as { clientSecret?: string; customerId?: string; error?: string }
    console.log(`[OrganiserPaymentForm] fetchSetupIntent resolved at ${new Date().toISOString()} | ok=${r.ok} | hasSecret=${!!data.clientSecret}`)
    return data
  }

  // Called by CardStep when stripe.confirmSetup returns an error.
  // The used SetupIntent may be in an unretryable state, so we fetch a fresh one
  // before the user can submit again.
  async function handleConfirmError(message: string) {
    setFormError(message)
    if (!details) return
    setRefreshing(true)
    try {
      const data = await fetchSetupIntent(details)
      if (data.clientSecret && data.customerId) {
        setClientSecret(data.clientSecret)
        setCustomerId(data.customerId)
        setSetupKey(k => k + 1)  // forces <Elements> to remount with clean intent
      }
    } catch {
      // Leave the form in place; user can refresh the page if needed.
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    console.log(`[OrganiserPaymentForm] useEffect fired at ${new Date().toISOString()}`)
    const raw = sessionStorage.getItem('bmp_create_details')
    if (!raw) {
      router.replace(`/slots/${slot.id}/create`)
      return
    }
    let parsed: CreateDetails
    try {
      parsed = JSON.parse(raw)
    } catch {
      router.replace(`/slots/${slot.id}/create`)
      return
    }
    setDetails(parsed)

    fetchSetupIntent(parsed)
      .then(data => {
        if (data.clientSecret && data.customerId) {
          console.log(`[OrganiserPaymentForm] setting clientSecret+customerId at ${new Date().toISOString()}`)
          setClientSecret(data.clientSecret)
          setCustomerId(data.customerId)
        } else {
          setInitError(data.error ?? 'Failed to initialise payment')
        }
      })
      .catch(() => setInitError('Failed to initialise payment. Please try again.'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (initError) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        <div
          style={{
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.2)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            fontSize: '13px',
            color: 'var(--red)',
            fontWeight: 600,
            marginBottom: '1rem',
          }}
        >
          {initError}
        </div>
        <button
          onClick={() => router.replace(`/slots/${slot.id}/create`)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ← Back to details
        </button>
      </div>
    )
  }

  if (!clientSecret || !details) {
    return (
      <div style={{ maxWidth: '480px', margin: '4rem auto', textAlign: 'center', color: 'var(--muted)', fontSize: '15px', fontWeight: 500 }}>
        Setting up payment…
      </div>
    )
  }

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
        Add your card
      </div>
      <div
        className="anim-fade-up d-80"
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: 'clamp(24px, 5vw, 34px)',
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
          marginBottom: '0.4rem',
        }}
      >
        Confirm your spot
      </div>
      <div
        className="anim-fade-up d-150"
        style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '1.75rem', fontWeight: 500 }}
      >
        {startTime} – {endTime} · {formatDate(slot.date)} · {typeLabel} · {slot.venue?.name ?? 'Globe Football Pitch'}
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
              marginBottom: challengedPlayerCount !== null ? '5px' : 0,
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

      {formError && (
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
          {formError}
        </div>
      )}

      <div className="anim-fade-up d-220">
        {/* key={setupKey} forces a full remount when a fresh SetupIntent is fetched,
            preventing stripe.confirmSetup from reusing a spent intent. */}
        <Elements key={setupKey} stripe={stripePromise} options={{ clientSecret, appearance }}>
          <CardStep
            slot={slot}
            details={details}
            customerId={customerId}
            challengeSessionId={challengeSessionId}
            onConfirmError={handleConfirmError}
            parentDisabled={refreshing}
          />
        </Elements>
      </div>

      <button
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginTop: '1.25rem',
          display: 'block',
        }}
      >
        ← Back to details
      </button>
    </div>
  )
}
