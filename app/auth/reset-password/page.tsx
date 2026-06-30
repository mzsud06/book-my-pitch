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
            Set new password
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
            Enter and confirm your new password below.
          </div>

          <form
            className="anim-fade-up d-80"
            onSubmit={handleReset}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
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
                  background: 'rgba(255,68,68,0.07)',
                  border: '1px solid rgba(255,68,68,0.18)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.875rem 1rem',
                  fontSize: '13px',
                  color: 'var(--red)',
                  fontWeight: 500,
                  lineHeight: 1.55,
                  fontFamily: 'var(--font-sans)',
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
                minHeight: '52px',
                fontSize: '15px',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'var(--surface3)' : 'var(--green)',
                color: loading ? 'var(--text-tertiary)' : 'var(--black)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '-0.015em',
                marginTop: '8px',
                transition: 'background 160ms ease, color 160ms ease, transform 160ms var(--ease-out), box-shadow 160ms ease',
                lineHeight: 1,
                opacity: loading ? 0.5 : 1,
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
