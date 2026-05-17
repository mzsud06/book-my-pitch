'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setError('Sign-up succeeded but no session was created. Email confirmation may still be enabled — please contact support.')
      setLoading(false)
      return
    }

    router.refresh()
    router.push('/my-bookings')
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.65rem 0.9rem',
    color: 'var(--text)',
    fontFamily: "'Archivo', sans-serif",
    fontSize: '14px',
    outline: 'none',
  }

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--muted)',
    marginBottom: '5px',
    display: 'block',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  }

  return (
    <>
      <Nav />
      <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '0 1.5rem' }}>
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
          Create account
        </div>
        <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--green)', textDecoration: 'none' }}>Log in</Link>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={labelStyle}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div><label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div><label style={labelStyle}>Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+44 7700 000000" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div><label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 8 characters" minLength={8} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>

          {error && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.85rem', fontSize: '15px', borderRadius: '10px', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'var(--surface2)' : 'var(--green)',
              color: loading ? 'var(--muted)' : 'var(--black)',
              fontFamily: "'Archivo', sans-serif", fontWeight: 600,
            }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
            By signing up you agree to our terms of service.
          </div>
        </form>
      </div>
    </>
  )
}
