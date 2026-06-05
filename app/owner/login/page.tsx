'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function OwnerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid credentials')
      setLoading(false)
      return
    }

    router.push('/owner/dashboard')
  }

  const inputStyle: React.CSSProperties = {
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--black)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        position: 'relative',
      }}
    >
      {/* Background glow */}
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

      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div
          className="anim-fade-up"
          style={{ textAlign: 'center', marginBottom: '2.5rem' }}
        >
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: '20px',
                letterSpacing: '-0.04em',
                color: 'var(--text)',
                lineHeight: 1,
              }}
            >
              Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
              <span style={{ color: 'var(--green)', fontSize: '13px', verticalAlign: 'super', marginLeft: '1px' }}>.uk</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div
          className="anim-fade-up d-80"
          style={{
            background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderTop: '2px solid var(--green)',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Card header */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(198,241,53,0.08)',
                border: '1px solid rgba(198,241,53,0.16)',
                borderRadius: '6px',
                padding: '3px 10px',
                marginBottom: '1rem',
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'var(--green)',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--green)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Owner portal
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: '26px',
                letterSpacing: '-0.04em',
                lineHeight: 0.95,
                marginBottom: '0.35rem',
              }}
            >
              Dashboard access
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
              Sign in with your venue owner credentials
            </div>
          </div>

          <form
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
                placeholder="owner@globepitch.co.uk"
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
              {loading ? 'Accessing…' : 'Access dashboard →'}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div
          className="anim-fade-up d-100"
          style={{ textAlign: 'center', marginTop: '1.5rem' }}
        >
          <Link
            href="/"
            style={{
              fontSize: '13px',
              color: 'var(--muted)',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.15s ease',
            }}
          >
            ← Back to site
          </Link>
        </div>
      </div>
    </div>
  )
}
