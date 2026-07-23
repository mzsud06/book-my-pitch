import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'

export default function Loading() {
  return (
    <>
      <Nav />
      <div style={{ paddingBottom: '5rem' }}>
        <Container>
          <div style={{ paddingTop: 'clamp(2.5rem, 6vh, 3.5rem)' }}>

            {/* Page header skeleton */}
            <div style={{ marginBottom: '2.5rem', maxWidth: '640px' }}>
              <div className="skeleton" style={{ height: '13px', width: '76px', borderRadius: '9999px', marginBottom: '14px' }} />
              <div className="skeleton" style={{ height: '36px', width: '70%', borderRadius: '10px', marginBottom: '10px' }} />
              <div className="skeleton" style={{ height: '16px', width: '85%', borderRadius: '8px' }} />
            </div>

            {/* Venue card skeletons */}
            <div className="venue-grid">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: '320px', borderRadius: 'var(--radius-xl)', animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>

          </div>
        </Container>
      </div>
    </>
  )
}
