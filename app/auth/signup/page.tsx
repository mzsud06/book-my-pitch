'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/slots'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    let valid = true

    if (!name.trim() || !/^[A-Za-z ]+$/.test(name.trim())) {
      setNameError('Please enter a valid name')
      valid = false
    }

    const atIdx = email.indexOf('@')
    if (atIdx < 0 || !email.slice(atIdx + 1).includes('.')) {
      setEmailError('Please enter a valid email address')
      valid = false
    }

    if (!valid) return

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }

    router.refresh()
    router.push(redirectTo)
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    color: 'var(--text)',
    fontFamily: "'Archivo', sans-serif",
    fontWeight: 600,
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  }

  const labelStyle = {
    fontSize: '10px',
    color: 'var(--muted)',
    marginBottom: '7px',
    display: 'block',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
  }

  return (
    <div className="auth-layout">
      {/* Brand panel */}
      <div className="auth-brand-panel">
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '18px',
              letterSpacing: '-0.04em',
              color: 'var(--text)',
              lineHeight: 1,
            }}
          >
            Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
            <span style={{ color: 'var(--green)', fontSize: '14px', verticalAlign: 'super', marginLeft: '1px' }}>.uk</span>
          </span>
        </Link>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 'clamp(42px, 5vw, 72px)',
              letterSpacing: '-0.04em',
              lineHeight: 0.88,
              margin: '0 0 1.5rem',
              color: 'var(--text)',
            }}
          >
            Your game<br />
            <span style={{ color: 'var(--green)' }}>starts here.</span>
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7, fontWeight: 500, maxWidth: '340px' }}>
            Create an account to track your sessions, view your bookings, and get notified the moment your game is confirmed.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '2.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          {[
            { n: '10', l: 'players per game' },
            { n: '£0', l: 'until full' },
            { n: '4G', l: 'all-weather' },
          ].map((stat, idx) => (
            <div key={idx}>
              <div
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '30px',
                  color: 'var(--green)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                {stat.n}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                {stat.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-form-panel">
        <div style={{ width: '100%', maxWidth: '380px' }}>

          {emailSent ? (
            <div className="anim-fade-up" style={{ textAlign: 'center', paddingTop: '1rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  background: 'rgba(198,241,53,0.08)',
                  border: '1px solid rgba(198,241,53,0.25)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                  margin: '0 auto 1.5rem',
                  color: 'var(--green)',
                }}
              >
                ✉
              </div>
              <div
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '24px',
                  letterSpacing: '-0.04em',
                  marginBottom: '0.75rem',
                  lineHeight: 1,
                }}
              >
                Check your email
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.65, marginBottom: '2rem' }}>
                We&apos;ve sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                Click the link to activate your account, then come back to log in.
              </div>
              <Link
                href={`/auth/login${redirectTo !== '/slots' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em' }}
              >
                Go to login →
              </Link>
            </div>
          ) : (
            <>
          <div
            className="anim-fade-up"
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '28px',
              letterSpacing: '-0.04em',
              marginBottom: '0.3rem',
              lineHeight: 0.95,
            }}
          >
            Create account
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem', fontWeight: 500 }}>
            Already have an account?{' '}
            <Link
              href={`/auth/login${redirectTo !== '/slots' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}
            >
              Log in
            </Link>
          </div>

          <form
            className="anim-fade-up d-80"
            onSubmit={handleSignup}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label style={labelStyle}>Name</label>
              <input
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
                required
                placeholder="Your full name"
                className="field-input"
                style={inputStyle}
              />
              {nameError && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{nameError}</div>}
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                required
                placeholder="you@example.com"
                className="field-input"
                style={inputStyle}
              />
              {emailError && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{emailError}</div>}
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Min 8 characters"
                minLength={8}
                className="field-input"
                style={inputStyle}
              />
            </div>

            {error && (
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
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!nameError || !!emailError}
              className={!loading && !nameError && !emailError ? 'btn-g' : ''}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '16px',
                borderRadius: '12px',
                border: 'none',
                cursor: loading || nameError || emailError ? 'not-allowed' : 'pointer',
                background: loading || nameError || emailError ? 'var(--surface2)' : 'var(--green)',
                color: loading || nameError || emailError ? 'var(--muted)' : 'var(--black)',
                fontFamily: "'Archivo Black', sans-serif",
                fontWeight: 900,
                letterSpacing: '-0.025em',
                marginTop: '4px',
                transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                lineHeight: 1,
              }}
            >
              {loading ? 'Creating account…' : 'Create account →'}
            </button>

            <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', fontWeight: 500 }}>
              By signing up you agree to our terms of service.
            </div>
          </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
