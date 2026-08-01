'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/slots'
  const message = searchParams.get('message')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [view, setView] = useState<'login' | 'forgot' | 'sent'>('login')
  const [resetLoading, setResetLoading] = useState(false)

  function validateEmail(val: string): boolean {
    const at = val.indexOf('@')
    if (at < 0 || !val.slice(at + 1).includes('.')) {
      setEmailError('Please enter a valid email address')
      return false
    }
    return true
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEmail(email)) return
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      if (authError.message.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email before logging in. Check your inbox for the confirmation link we sent you.')
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    router.refresh()
    router.push(redirectTo)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEmail(email)) return
    setResetLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    setResetLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    setView('sent')
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

        {/* Contextual notice (e.g. "You need an account to create a game") */}
        {message && (
          <div
            style={{
              background: 'rgba(22,48,31,0.6)',
              border: '1px solid rgba(198,241,53,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '0.875rem 1rem',
              marginBottom: '1rem',
              fontSize: '14px',
              color: 'var(--green)',
              fontWeight: 500,
              lineHeight: 1.55,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {message}
          </div>
        )}

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

          {/* ── Login view ── */}
          {view === 'login' && (
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
                Log in
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
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>
                  Sign up
                </Link>
              </div>

              <form
                className="anim-fade-up d-80"
                onSubmit={handleLogin}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
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
                    placeholder="••••••••"
                    className="field-input"
                    style={inputStyle}
                  />
                </div>

                <div style={{ textAlign: 'right', marginTop: '-4px', marginRight: '-8px' }}>
                  <button
                    type="button"
                    onClick={() => { setError(''); setEmailError(''); setView('forgot') }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--green)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '8px',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                {error && <div style={errorPanel}>{error}</div>}

                <button
                  type="submit"
                  disabled={loading || !!emailError}
                  className={!loading && !emailError ? 'btn-g' : ''}
                  style={submitBtn(loading || !!emailError)}
                >
                  {loading ? 'Logging in…' : 'Log in →'}
                </button>
              </form>
            </>
          )}

          {/* ── Forgot password view ── */}
          {view === 'forgot' && (
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
                Reset password
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
                Enter your email and we&apos;ll send you a reset link.
              </div>

              <form
                className="anim-fade-up d-80"
                onSubmit={handleForgotPassword}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
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

                {error && <div style={errorPanel}>{error}</div>}

                <button
                  type="submit"
                  disabled={resetLoading || !!emailError}
                  className={!resetLoading && !emailError ? 'btn-g' : ''}
                  style={submitBtn(resetLoading || !!emailError)}
                >
                  {resetLoading ? 'Sending…' : 'Send reset link →'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setError(''); setEmailError(''); setView('login') }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '1rem 0 0',
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                ← Back to login
              </button>
            </>
          )}

          {/* ── Sent confirmation view ── */}
          {view === 'sent' && (
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
                We&apos;ve sent a reset link to{' '}
                <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{email}</strong>.
                {' '}Check your inbox and follow the link to set a new password.
              </div>
              <button
                type="button"
                onClick={() => setView('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--green)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                ← Back to login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
