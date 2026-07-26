import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'

export default function Loading() {
  return (
    <>
      <Nav />
      <div style={{ paddingBottom: '5rem' }}>
        <Container>
          <div style={{ paddingTop: 'clamp(2rem, 5vh, 3rem)' }}>

            {/* Hero banner skeleton */}
            <div
              className="skeleton"
              style={{ height: '168px', borderRadius: 'var(--radius-2xl)', marginBottom: '2rem' }}
            />

            {/* Toolbar skeleton */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem' }}>
              <div className="skeleton" style={{ height: '44px', flex: '1 1 260px', borderRadius: 'var(--radius-full)' }} />
              <div className="skeleton" style={{ height: '44px', width: '110px', borderRadius: 'var(--radius-full)' }} />
              <div className="skeleton" style={{ height: '44px', width: '150px', borderRadius: 'var(--radius-full)', marginLeft: 'auto' }} />
            </div>

            {/* Sidebar + grid skeleton */}
            <div className="venues-body">
              <div className="skeleton" style={{ height: '420px', borderRadius: 'var(--radius-xl)' }} />
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

          </div>
        </Container>
      </div>
    </>
  )
}
