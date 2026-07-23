import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'

export default function Loading() {
  return (
    <>
      <Nav />
      <div style={{ paddingBottom: '5rem' }}>
        <Container>
          <div style={{ paddingTop: '2.25rem' }}>

            {/* Venue header skeleton */}
            <div style={{ marginBottom: '2rem' }}>
              <div className="skeleton" style={{ height: '40px', width: '55%', borderRadius: '10px', marginBottom: '14px' }} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="skeleton" style={{ height: '18px', width: '190px', borderRadius: '9999px' }} />
                <div className="skeleton" style={{ height: '22px', width: '32px', borderRadius: '9999px' }} />
                <div className="skeleton" style={{ height: '22px', width: '58px', borderRadius: '9999px' }} />
              </div>
            </div>

            {/* Select Date label + toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <div className="skeleton" style={{ height: '13px', width: '76px', borderRadius: '9999px' }} />
              <div className="skeleton" style={{ height: '20px', width: '128px', borderRadius: '9999px' }} />
            </div>

            {/* 7-day chips — no arrows */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '2rem' }}>
              {Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ minHeight: '76px', borderRadius: '14px', animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>

            {/* Start Time label */}
            <div className="skeleton" style={{ height: '13px', width: '68px', borderRadius: '9999px', marginBottom: '0.875rem' }} />

            {/* Time pills grid — 2-col mobile */}
            <div className="time-pills-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ minHeight: '72px', borderRadius: '14px', animationDelay: `${i * 55}ms` }}
                />
              ))}
            </div>

          </div>
        </Container>
      </div>
    </>
  )
}
