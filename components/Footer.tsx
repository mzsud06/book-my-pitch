import Link from 'next/link'
import { Logo } from '@/components/Logo'

const linkStyle = {
  fontSize: '16px',
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '44px',
}

const columnLabelStyle = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '0.1rem',
}

const columnStyle = { display: 'flex', flexDirection: 'column' as const }

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'clamp(3rem, 8vh, 5rem)', background: '#FFFFFF' }}>
      <div
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: 'clamp(2.5rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 2rem) 2rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '2rem 3rem',
        }}
      >
        <div style={{ maxWidth: '300px' }}>
          <Logo />
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.5 }}>
            5-a-side and 7-a-side football pitches in East London. Run by Masud Rahman, Admin.
          </p>
          <a href="mailto:masud@bookmypitch.uk" style={{ ...linkStyle, color: 'var(--green)', fontWeight: 600 }}>masud@bookmypitch.uk</a>
        </div>

        <div style={columnStyle}>
          <div style={columnLabelStyle}>Players</div>
          <Link href="/slots" style={linkStyle}>Book a pitch</Link>
          <Link href="/public-games" style={linkStyle}>Public games</Link>
          <Link href="/#faq" style={linkStyle}>Questions</Link>
        </div>

        <div style={columnStyle}>
          <div style={columnLabelStyle}>For venues</div>
          <Link href="/list-your-venue" style={linkStyle}>List your pitch</Link>
          <Link href="/owner/login" style={linkStyle}>Venue login</Link>
        </div>

        <div style={columnStyle}>
          <div style={columnLabelStyle}>Help</div>
          <a href="mailto:masud@bookmypitch.uk" style={linkStyle}>Get in touch</a>
          <a href="mailto:masud@bookmypitch.uk?subject=Bug Report" style={linkStyle}>Report a bug</a>
          <Link href="/terms" style={linkStyle}>Terms</Link>
          <Link href="/privacy" style={linkStyle}>Privacy</Link>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '1rem clamp(1.25rem, 4vw, 2rem)', fontSize: '14px', color: 'var(--text-tertiary)' }}>
          © {new Date().getFullYear()} BookMyPitch
        </div>
      </div>
    </footer>
  )
}
