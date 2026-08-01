'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { readOwnerSignupDraft, writeOwnerSignupDraft, clearOwnerSignupDraft } from '@/lib/clientStorage'

const FORMATS = [
  { value: '5-a-side', label: '5-a-side' },
  { value: '7-a-side', label: '7-a-side' },
  { value: '11-a-side', label: '11-a-side' },
]
const SURFACES = ['4G', '3G', 'Grass']

interface PitchDraft {
  id: number
  format: string
  surface: string
  samePrice: boolean
  flatPrice: string
  offpeakPrice: string
  peakPrice: string
  weekendPrice: string
}

let nextPitchId = 1
function newPitchDraft(): PitchDraft {
  return {
    id: nextPitchId++,
    format: '5-a-side',
    surface: '4G',
    samePrice: true,
    flatPrice: '',
    offpeakPrice: '',
    peakPrice: '',
    weekendPrice: '',
  }
}

interface FormDraft {
  email: string
  venueName: string
  address: string
  openingTime: string
  closingTime: string
  weekendOpeningTime: string
  weekendClosingTime: string
  peakStartTime: string
  pitches: Omit<PitchDraft, 'id'>[]
}

export default function OwnerSignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [venueName, setVenueName] = useState('')
  const [address, setAddress] = useState('')
  const [openingTime, setOpeningTime] = useState('15:30')
  const [closingTime, setClosingTime] = useState('21:30')
  const [weekendOpeningTime, setWeekendOpeningTime] = useState('09:30')
  const [weekendClosingTime, setWeekendClosingTime] = useState('21:30')
  const [peakStartTime, setPeakStartTime] = useState('18:30')
  const [pitchDrafts, setPitchDrafts] = useState<PitchDraft[]>([newPitchDraft()])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [stripeSetupPending, setStripeSetupPending] = useState(false)

  // Already logged in (player or a previous owner signup) — skip the account
  // section entirely rather than force a second, colliding signup.
  const [checkingSession, setCheckingSession] = useState(true)
  const [existingUserEmail, setExistingUserEmail] = useState<string | null>(null)

  // Restore an in-progress draft (never the password) so a closed tab or dead
  // connection mid-fill doesn't mean starting over — form is long enough that
  // losing it is real friction.
  const restoredDraft = useRef(false)
  useEffect(() => {
    if (restoredDraft.current) return
    restoredDraft.current = true
    const draft = readOwnerSignupDraft<FormDraft>()
    if (!draft) return
    setEmail(draft.email ?? '')
    setVenueName(draft.venueName ?? '')
    setAddress(draft.address ?? '')
    if (draft.openingTime) setOpeningTime(draft.openingTime)
    if (draft.closingTime) setClosingTime(draft.closingTime)
    if (draft.weekendOpeningTime) setWeekendOpeningTime(draft.weekendOpeningTime)
    if (draft.weekendClosingTime) setWeekendClosingTime(draft.weekendClosingTime)
    if (draft.peakStartTime) setPeakStartTime(draft.peakStartTime)
    if (draft.pitches?.length) {
      setPitchDrafts(draft.pitches.map(p => ({ ...p, id: nextPitchId++ })))
    }
  }, [])

  // Persist on every change (excluding password) — cheap localStorage write,
  // no debounce needed at this form size.
  useEffect(() => {
    if (!restoredDraft.current) return
    writeOwnerSignupDraft<FormDraft>({
      email, venueName, address,
      openingTime, closingTime, weekendOpeningTime, weekendClosingTime, peakStartTime,
      pitches: pitchDrafts.map(({ id, ...rest }) => rest),
    })
  }, [email, venueName, address, openingTime, closingTime, weekendOpeningTime, weekendClosingTime, peakStartTime, pitchDrafts])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setExistingUserEmail(data.user?.email ?? null)
      setCheckingSession(false)
    })
  }, [])

  async function handleSignOut() {
    await createClient().auth.signOut()
    setExistingUserEmail(null)
  }

  function updatePitch(id: number, patch: Partial<PitchDraft>) {
    setPitchDrafts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  function addPitch() {
    setPitchDrafts(prev => [...prev, newPitchDraft()])
  }

  function removePitch(id: number) {
    setPitchDrafts(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev)
  }

  function validate(): string | null {
    if (!existingUserEmail) {
      const atIdx = email.indexOf('@')
      if (atIdx < 0 || !email.slice(atIdx + 1).includes('.')) return 'Please enter a valid email address'
      if (password.length < 8) return 'Password must be at least 8 characters'
      if (password !== confirmPassword) return 'Passwords do not match'
    }
    if (!venueName.trim()) return 'Please enter your venue name'
    if (!address.trim()) return 'Please enter your venue address'
    if (closingTime <= openingTime) return 'Weekday closing time must be later than opening time (hours past midnight aren\'t supported yet)'
    if (weekendClosingTime <= weekendOpeningTime) return 'Weekend closing time must be later than opening time (hours past midnight aren\'t supported yet)'

    for (let i = 0; i < pitchDrafts.length; i++) {
      const p = pitchDrafts[i]
      const label = pitchDrafts.length > 1 ? `Pitch ${i + 1}` : 'Pitch'
      const prices = p.samePrice
        ? [['price', p.flatPrice]] as const
        : [['Off-peak', p.offpeakPrice], ['Peak', p.peakPrice], ['Weekend', p.weekendPrice]] as const
      for (const [name, val] of prices) {
        const n = Number(val)
        if (!val || !Number.isInteger(n) || n < 1 || n > 500) {
          return `${label}: ${name} price must be a whole number between £1 and £500`
        }
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const pitches = pitchDrafts.map(p => ({
        format: p.format,
        surface: p.surface,
        offpeakPrice: Number(p.samePrice ? p.flatPrice : p.offpeakPrice),
        peakPrice: Number(p.samePrice ? p.flatPrice : p.peakPrice),
        weekendPrice: Number(p.samePrice ? p.flatPrice : p.weekendPrice),
      }))

      const res = await fetch('/api/owner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          venueName,
          address,
          openingTime,
          closingTime,
          weekendOpeningTime,
          weekendClosingTime,
          peakStartTime,
          pitches,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create account')
        setLoading(false)
        return
      }

      if (!data.sessionCreated) {
        // Email confirmation required — venue/pitches already exist server-side,
        // Stripe setup just waits until they log in.
        clearOwnerSignupDraft()
        setEmailSent(true)
        setLoading(false)
        return
      }

      const linkRes = await fetch('/api/owner/stripe-onboarding-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: data.venueId }),
      })
      const linkData = await linkRes.json()

      if (!linkRes.ok) {
        // Venue + pitches already exist at this point (only the Stripe step
        // failed) — leaving the form open would let them resubmit and hit
        // an "email already registered" error, since the account is already
        // made. Switch to a dedicated recovery screen instead.
        clearOwnerSignupDraft()
        setStripeSetupPending(true)
        setLoading(false)
        return
      }

      clearOwnerSignupDraft()
      window.location.href = linkData.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
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

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--green)',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: '0.9rem',
    marginTop: '0.5rem',
  }

  const fieldWrap = (label: string, children: React.ReactNode) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--black)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: '-10vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(198,241,53,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1 }}>
        <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>
              Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
              <span style={{ color: 'var(--green)', fontSize: '13px', verticalAlign: 'super', marginLeft: '1px' }}>.uk</span>
            </span>
          </Link>
        </div>

        <Card
          className="anim-fade-up d-80"
          style={{
            border: '1px solid rgba(255,255,255,0.09)',
            borderTop: '2px solid var(--green)',
            padding: '2rem',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {stripeSetupPending ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '64px', height: '64px', background: 'rgba(22,48,31,0.7)',
                  border: '1px solid rgba(198,241,53,0.25)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', margin: '0 auto 1.5rem', color: 'var(--green)',
                }}
              >
                ✓
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '-0.03em', marginBottom: '0.75rem', color: 'var(--text)' }}>
                Your venue is set up
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '2rem' }}>
                We couldn&apos;t start Stripe payouts setup just now, that&apos;s the only thing that didn&apos;t finish.
                {' '}Log in and we&apos;ll pick up right where you left off.
              </div>
              <Link href="/owner/login" style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
                Go to owner login →
              </Link>
            </div>
          ) : emailSent ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '64px', height: '64px', background: 'rgba(22,48,31,0.7)',
                  border: '1px solid rgba(198,241,53,0.25)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', margin: '0 auto 1.5rem', color: 'var(--green)',
                }}
              >
                ✉
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '-0.03em', marginBottom: '0.75rem', color: 'var(--text)' }}>
                Check your email
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '2rem' }}>
                We&apos;ve sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                {' '}Your venue is already set up, click the link, then log in to finish connecting your payouts.
              </div>
              <Link href="/owner/login" style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
                Go to owner login →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1.75rem' }}>
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(198,241,53,0.08)', border: '1px solid rgba(198,241,53,0.16)',
                    borderRadius: '6px', padding: '3px 10px', marginBottom: '1rem',
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    List your venue
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '-0.04em', lineHeight: 0.95, marginBottom: '0.35rem' }}>
                  Set up your pitch
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
                  Takes a few minutes. You&apos;ll finish payouts setup with Stripe next, then we do a quick manual
                  review before your venue goes live.
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!checkingSession && existingUserEmail ? (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
                      Signed in as {existingUserEmail}
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
                    >
                      Not you?
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={sectionLabelStyle}>Your account</div>
                    {fieldWrap('Email', (
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="owner@yourpitch.co.uk" style={inputStyle} />
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {fieldWrap('Password', (
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" style={inputStyle} />
                      ))}
                      {fieldWrap('Confirm password', (
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} placeholder="Repeat password" style={inputStyle} />
                      ))}
                    </div>
                  </>
                )}

                <div style={sectionLabelStyle}>Your venue</div>
                {fieldWrap('Venue name', (
                  <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} required maxLength={120} placeholder="e.g. Globe Football Pitch" style={inputStyle} />
                ))}
                {fieldWrap('Address', (
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} required maxLength={300} placeholder="Street, area, postcode" style={inputStyle} />
                ))}

                <div style={sectionLabelStyle}>Your hours</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {fieldWrap('Weekday opening time', (
                    <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} required style={inputStyle} />
                  ))}
                  {fieldWrap('Weekday closing time', (
                    <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} required style={inputStyle} />
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {fieldWrap('Weekend opening time', (
                    <input type="time" value={weekendOpeningTime} onChange={e => setWeekendOpeningTime(e.target.value)} required style={inputStyle} />
                  ))}
                  {fieldWrap('Weekend closing time', (
                    <input type="time" value={weekendClosingTime} onChange={e => setWeekendClosingTime(e.target.value)} required style={inputStyle} />
                  ))}
                </div>
                {fieldWrap('Peak time starts at', (
                  <input type="time" value={peakStartTime} onChange={e => setPeakStartTime(e.target.value)} required style={inputStyle} />
                ))}
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-6px', fontWeight: 500 }}>
                  Every day, bookings from this time use your peak price below. Only matters if you set different peak/off-peak pricing for a pitch.
                </div>

                <div style={sectionLabelStyle}>Your pitches</div>
                {pitchDrafts.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                        {pitchDrafts.length > 1 ? `Pitch ${i + 1}` : 'Pitch details'}
                      </div>
                      {pitchDrafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePitch(p.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {fieldWrap('Format', (
                        <select value={p.format} onChange={e => updatePitch(p.id, { format: e.target.value })} style={inputStyle}>
                          {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      ))}
                      {fieldWrap('Surface', (
                        <select value={p.surface} onChange={e => updatePitch(p.id, { surface: e.target.value })} style={inputStyle}>
                          {SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ))}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', fontWeight: 500, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={p.samePrice}
                        onChange={e => updatePitch(p.id, { samePrice: e.target.checked })}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--green)' }}
                      />
                      Same price at all times
                    </label>

                    {p.samePrice ? (
                      fieldWrap('Hourly price', (
                        <input
                          type="number" min={1} max={500}
                          value={p.flatPrice}
                          onChange={e => updatePitch(p.id, { flatPrice: e.target.value })}
                          placeholder="e.g. 30"
                          style={inputStyle}
                        />
                      ))
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        {fieldWrap('Off-peak £', (
                          <input type="number" min={1} max={500} value={p.offpeakPrice} onChange={e => updatePitch(p.id, { offpeakPrice: e.target.value })} placeholder="e.g. 30" style={inputStyle} />
                        ))}
                        {fieldWrap('Peak £', (
                          <input type="number" min={1} max={500} value={p.peakPrice} onChange={e => updatePitch(p.id, { peakPrice: e.target.value })} placeholder="e.g. 50" style={inputStyle} />
                        ))}
                        {fieldWrap('Weekend £', (
                          <input type="number" min={1} max={500} value={p.weekendPrice} onChange={e => updatePitch(p.id, { weekendPrice: e.target.value })} placeholder="e.g. 40" style={inputStyle} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPitch}
                  style={{
                    background: 'none', border: '1px dashed var(--border)', borderRadius: '10px',
                    padding: '0.7rem', color: 'var(--green)', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '-0.01em',
                  }}
                >
                  + Add another pitch
                </button>

                {error && (
                  <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '13px', color: 'var(--red)', fontWeight: 600, lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={!loading ? 'btn-g' : ''}
                  style={{
                    width: '100%', padding: '1rem', fontSize: '16px', borderRadius: '12px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'var(--surface2)' : 'var(--green)',
                    color: loading ? 'var(--muted)' : 'var(--black)',
                    fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '-0.025em',
                    marginTop: '4px', lineHeight: 1,
                  }}
                >
                  {loading ? 'Setting up…' : 'Create venue →'}
                </button>

                <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
                  By continuing you agree to our{' '}
                  <Link href="/terms" style={{ color: 'var(--green)', textDecoration: 'none' }}>terms</Link>{' '}
                  and{' '}
                  <Link href="/privacy" style={{ color: 'var(--green)', textDecoration: 'none' }}>privacy policy</Link>.
                </div>
              </form>
            </>
          )}
        </Card>

        <div className="anim-fade-up d-100" style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '18px' }}>
          <Link href="/owner/login" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>
            Already listed? Sign in
          </Link>
          <Link href="/" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>
            ← Back to site
          </Link>
        </div>
      </div>
    </div>
  )
}
