'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.875rem 1rem',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: '15px',
    outline: 'none',
    minHeight: '48px',
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    display: 'block',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-sans)',
  }

  const submitBtn = (disabled: boolean): React.CSSProperties => ({
    width: '100%',
    minHeight: '52px',
    fontSize: '15px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'var(--surface3)' : 'var(--green)',
    color: disabled ? 'var(--text-tertiary)' : 'var(--black)',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    letterSpacing: '-0.015em',
    marginTop: '8px',
    transition: 'background 160ms ease, color 160ms ease, transform 160ms var(--ease-out), box-shadow 160ms ease',
    lineHeight: 1,
    opacity: disabled ? 0.5 : 1,
  })

  const errorPanel: React.CSSProperties = {
    background: 'rgba(255,68,68,0.07)',
    border: '1px solid rgba(255,68,68,0.18)',
    borderRadius: 'var(--radius-md)',
    padding: '0.875rem 1rem',
    fontSize: '13px',
    color: 'var(--red)',
    fontWeight: 500,
    lineHeight: 1.55,
    fontFamily: 'var(--font-sans)',
  }

  const isDisabled = loading || !!nameError || !!emailError

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(2rem, 5vh, 3rem) 1.25rem',
        background: 'var(--black)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                letterSpacing: '-0.03em',
                color: 'var(--text)',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
              <span
                style={{
                  color: 'var(--green)',
                  fontSize: '13px',
                  verticalAlign: 'super',
                  marginLeft: '1px',
                  opacity: 0.75,
                  fontWeight: 600,
                }}
              >
                .uk
              </span>
            </span>
          </Link>
        </div>

        {/* Form card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(1.5rem, 4vw, 2rem)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >

          {emailSent ? (

            /* ── Email sent confirmation ── */
            <div className="anim-fade-up" style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  background: 'rgba(22,48,31,0.7)',
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
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  color: 'var(--text)',
                  marginBottom: '0.75rem',
                }}
              >
                Check your email
              </h1>
              <div
                style={{
                  fontSize: '15px',
                  color: 'var(--text-secondary)',
                  fontWeight: 400,
                  lineHeight: 1.65,
                  marginBottom: '2rem',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                We&apos;ve sent a confirmation link to{' '}
                <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{email}</strong>.
                {' '}Click the link to activate your account, then come back to log in.
              </div>
              <Link
                href={`/auth/login${redirectTo !== '/slots' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em', fontFamily: 'var(--font-sans)' }}
              >
                Go to login →
              </Link>
            </div>

          ) : (

            /* ── Sign-up form ── */
            <>
              <h1
                className="anim-fade-up"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '28px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  color: 'var(--text)',
                  margin: '0 0 6px',
                }}
              >
                Create account
              </h1>
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  fontWeight: 400,
                  marginBottom: '1.75rem',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Already have an account?{' '}
                <Link
                  href={`/auth/login${redirectTo !== '/slots' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                  style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}
                >
                  Log in
                </Link>
              </div>

              <form
                className="anim-fade-up d-80"
                onSubmit={handleSignup}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^a-zA-Z0-9\s]/g, '')
                      setName(cleaned)
                    }}
                    onKeyDown={(e) => {
                      if (e.ctrlKey || e.metaKey) return
                      if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
                      if (!/^[a-zA-Z0-9\s]$/.test(e.key)) e.preventDefault()
                    }}
                    required
                    placeholder="Your full name"
                    className="field-input"
                    style={inputStyle}
                  />
                  {nameError && (
                    <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '6px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                      {nameError}
                    </div>
                  )}
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
                  {emailError && (
                    <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '6px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                      {emailError}
                    </div>
                  )}
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

                {error && <div style={errorPanel}>{error}</div>}

                <button
                  type="submit"
                  disabled={isDisabled}
                  className={!isDisabled ? 'btn-g' : ''}
                  style={submitBtn(isDisabled)}
                >
                  {loading ? 'Creating account…' : 'Create account →'}
                </button>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 400, fontFamily: 'var(--font-sans)' }}>
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
