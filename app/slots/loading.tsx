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
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '1.1rem 1.25rem', opacity: 0.5,
              borderLeft: '3px solid var(--border)', height: '96px',
            }} />
          ))}
        </div>
      </div>
    </>
  )
}
