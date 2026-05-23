import Nav from '@/components/Nav'

export default function Loading() {
  return (
    <>
      <Nav />
      <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem', opacity: 0.5, height: '200px' }} />
        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '1rem', opacity: 0.5, height: '52px' }} />
      </div>
    </>
  )
}
