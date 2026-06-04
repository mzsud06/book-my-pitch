import Nav from '@/components/Nav'

export default function Loading() {
  return (
    <>
      <Nav />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.25rem', opacity: 0.4 }}>
          Globe Football Pitch
        </div>
        <div style={{ fontSize: '15px', color: 'var(--muted)', marginBottom: '2rem', opacity: 0.4 }}>
          Loading slots…
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px', padding: '1.25rem 1.4rem',
                height: '110px',
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
