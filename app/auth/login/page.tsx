import { Suspense } from 'react'
import LoginForm from './LoginForm'
import Nav from '@/components/Nav'

export default function LoginPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}>
        <LoginForm />
      </Suspense>
    </>
  )
}
