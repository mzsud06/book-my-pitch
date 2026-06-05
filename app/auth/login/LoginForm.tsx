'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/my-bookings'
  const message = searchParams.get('message')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'login' | 'forgot' | 'sent'>('login')
  const [resetLoading, setResetLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
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
            Fill the team.
            <br />
            <span style={{ color: 'var(--green)' }}>Book the pitch.</span>
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7, fontWeight: 500, maxWidth: '340px' }}>
            Sign in to track your bookings and stay in the loop when your game fills up.
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

          {/* ── Login view ── */}
          {view === 'login' && (
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
                Log in
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem', fontWeight: 500 }}>
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>
                  Sign up
                </Link>
              </div>

              {message && (
                <div
                  style={{
                    background: 'rgba(198,241,53,0.05)',
                    border: '1px solid rgba(198,241,53,0.2)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    marginBottom: '1.25rem',
                    fontSize: '14px',
                    color: 'var(--green)',
                    lineHeight: 1.55,
                    fontWeight: 600,
                  }}
                >
                  {message}
                </div>
              )}

              <form
                className="anim-fade-up d-80"
                onSubmit={handleLogin}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="field-input"
                    style={inputStyle}
                  />
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

                <div style={{ textAlign: 'right', marginTop: '-6px' }}>
                  <button
                    type="button"
                    onClick={() => { setError(''); setView('forgot') }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#C6F135',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Forgot password?
                  </button>
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
                  disabled={loading}
                  className={!loading ? 'btn-g' : ''}
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
                    marginTop: '4px',
                    transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                    lineHeight: 1,
                  }}
                >
                  {loading ? 'Logging in…' : 'Log in →'}
                </button>
              </form>
            </>
          )}

          {/* ── Forgot password view ── */}
          {view === 'forgot' && (
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
                Reset password
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem', fontWeight: 500 }}>
                Enter your email and we&apos;ll send you a reset link.
              </div>

              <form
                className="anim-fade-up d-80"
                onSubmit={handleForgotPassword}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
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
                  disabled={resetLoading}
                  className={!resetLoading ? 'btn-g' : ''}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    background: resetLoading ? 'var(--surface2)' : 'var(--green)',
                    color: resetLoading ? 'var(--muted)' : 'var(--black)',
                    fontFamily: "'Archivo Black', sans-serif",
                    fontWeight: 900,
                    letterSpacing: '-0.025em',
                    marginTop: '4px',
                    transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                    lineHeight: 1,
                  }}
                >
                  {resetLoading ? 'Sending…' : 'Send reset link →'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setError(''); setView('login') }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '1rem 0 0',
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                  letterSpacing: '-0.01em',
                }}
              >
                ← Back to login
              </button>
            </>
          )}

          {/* ── Sent confirmation view ── */}
          {view === 'sent' && (
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
                We&apos;ve sent a reset link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                Check your inbox and follow the link to set a new password.
              </div>
              <button
                type="button"
                onClick={() => setView('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#C6F135',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  letterSpacing: '-0.01em',
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
