'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    router.push('/my-bookings')
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
            New password.
            <br />
            <span style={{ color: 'var(--green)' }}>Fresh start.</span>
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7, fontWeight: 500, maxWidth: '340px' }}>
            Choose a strong password to keep your account secure.
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
            Set new password
          </div>
          <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem', fontWeight: 500 }}>
            Enter and confirm your new password below.
          </div>

          <form
            className="anim-fade-up d-80"
            onSubmit={handleReset}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min 8 characters"
                className="field-input"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
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
              {loading ? 'Updating…' : 'Update password →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
