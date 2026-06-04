import Nav from '@/components/Nav'

export default function Loading() {
  return (
    <>
      <Nav />
      <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div className="skeleton" style={{ border: '1px solid var(--border)', borderRadius: '14px', marginBottom: '1.25rem', height: '260px' }} />
        <div className="skeleton" style={{ borderRadius: '10px', height: '52px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ borderRadius: '10px', height: '52px', animationDelay: '120ms' }} />
      </div>
    </>
  )
}
