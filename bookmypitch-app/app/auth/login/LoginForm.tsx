'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/my-bookings'
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
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '0 1.5rem' }}>
      <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem' }}>
        Log in
      </div>
      <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem' }}>
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" style={{ color: 'var(--green)', textDecoration: 'none' }}>Sign up</Link>
      </div>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={{
              width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)',
              fontFamily: "'Archivo', sans-serif", fontSize: '14px', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{
              width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)',
              fontFamily: "'Archivo', sans-serif", fontSize: '14px', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(200,244,0,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
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
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
