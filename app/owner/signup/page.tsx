'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'

const FORMATS = [
  { value: '5-a-side', label: '5-a-side' },
  { value: '7-a-side', label: '7-a-side' },
  { value: '11-a-side', label: '11-a-side' },
]
const SURFACES = ['4G', '3G', 'Grass']

export default function OwnerSignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [venueName, setVenueName] = useState('')
  const [address, setAddress] = useState('')
  const [format, setFormat] = useState('5-a-side')
  const [surface, setSurface] = useState('4G')
  const [peakPrice, setPeakPrice] = useState('')
  const [offpeakPrice, setOffpeakPrice] = useState('')
  const [weekendPrice, setWeekendPrice] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  function validate(): string | null {
    const atIdx = email.indexOf('@')
    if (atIdx < 0 || !email.slice(atIdx + 1).includes('.')) return 'Please enter a valid email address'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (password !== confirmPassword) return 'Passwords do not match'
    if (!venueName.trim()) return 'Please enter your venue name'
    if (!address.trim()) return 'Please enter your venue address'
    for (const [label, val] of [['Peak', peakPrice], ['Off-peak', offpeakPrice], ['Weekend', weekendPrice]] as const) {
      const n = Number(val)
      if (!val || !Number.isInteger(n) || n < 1 || n > 500) return `${label} price must be a whole number between £1 and £500`
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
      const res = await fetch('/api/owner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          venueName,
          address,
          format,
          surface,
          peakPrice: Number(peakPrice),
          offpeakPrice: Number(offpeakPrice),
          weekendPrice: Number(weekendPrice),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create account')
        setLoading(false)
        return
      }

      if (!data.sessionCreated) {
        // Email confirmation required — venue/pitch already exist server-side,
        // Stripe setup just waits until they log in.
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
        setError('Account created, but starting Stripe setup failed. Log in and try again from your dashboard.')
        setLoading(false)
        return
      }

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

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
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
          {emailSent ? (
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
                {' '}Your venue is already set up — click the link, then log in to finish connecting your payouts.
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

                <div style={sectionLabelStyle}>Your venue</div>
                {fieldWrap('Venue name', (
                  <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} required maxLength={120} placeholder="e.g. Globe Football Pitch" style={inputStyle} />
                ))}
                {fieldWrap('Address', (
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} required maxLength={300} placeholder="Street, area, postcode" style={inputStyle} />
                ))}

                <div style={sectionLabelStyle}>Your pitch</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {fieldWrap('Format', (
                    <select value={format} onChange={e => setFormat(e.target.value)} style={inputStyle}>
                      {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  ))}
                  {fieldWrap('Surface', (
                    <select value={surface} onChange={e => setSurface(e.target.value)} style={inputStyle}>
                      {SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ))}
                </div>

                <div>
                  <label style={labelStyle}>Hourly price per game (whole £, split between players)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <input type="number" min={1} max={500} value={offpeakPrice} onChange={e => setOffpeakPrice(e.target.value)} placeholder="Off-peak £" style={inputStyle} />
                    <input type="number" min={1} max={500} value={peakPrice} onChange={e => setPeakPrice(e.target.value)} placeholder="Peak £" style={inputStyle} />
                    <input type="number" min={1} max={500} value={weekendPrice} onChange={e => setWeekendPrice(e.target.value)} placeholder="Weekend £" style={inputStyle} />
                  </div>
                </div>

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
