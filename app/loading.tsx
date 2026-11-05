import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'

export default function Loading() {
  return (
    <>
      <Nav />
      <main>
        <Container>
          <div role="status" aria-live="polite" style={{ paddingTop: 'clamp(2.5rem, 8vh, 4.5rem)' }}>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)' }}>Loading…</p>
            <div className="skeleton" style={{ height: '48px', maxWidth: '560px', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }} />
            <div className="skeleton" style={{ height: '20px', maxWidth: '420px', borderRadius: 'var(--radius-sm)', marginBottom: '0.6rem' }} />
            <div className="skeleton" style={{ height: '20px', maxWidth: '360px', borderRadius: 'var(--radius-sm)' }} />
          </div>
        </Container>
      </main>
    </>
  )
}
