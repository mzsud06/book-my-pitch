import Link from 'next/link'

const linkStyle = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  textDecoration: 'none',
}

const columnLabelStyle = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-tertiary)',
  marginBottom: '0.2rem',
}

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', marginTop: 'clamp(3rem, 8vh, 5rem)' }}>
      <div
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: 'clamp(2.5rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 2rem) 2.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '2.5rem',
        }}
      >
        {/* Left — logo + tagline */}
        <div style={{ maxWidth: '260px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: 'var(--text)',
            }}
          >
            Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px', verticalAlign: 'super', marginLeft: '1px', opacity: 0.75, fontWeight: 600 }}>.uk</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.6rem', lineHeight: 1.5 }}>
            Football booking for East London.
          </p>
        </div>

        {/* Middle — explore links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={columnLabelStyle}>Explore</div>
          <Link href="/public-games" style={linkStyle}>Find a game</Link>
          <Link href="/slots" style={linkStyle}>Browse slots</Link>
          <Link href="/#faq" style={linkStyle}>FAQ</Link>
        </div>

        {/* Venue owners */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={columnLabelStyle}>Venue owners</div>
          <Link href="/list-your-venue" style={linkStyle}>List your venue</Link>
          <Link href="/owner/login" style={linkStyle}>Owner login</Link>
        </div>

        {/* Right — support links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={columnLabelStyle}>Support</div>
          <a href="mailto:masud.bookmypitch@gmail.com" style={linkStyle}>Get in touch</a>
          <a href="mailto:masud.bookmypitch@gmail.com?subject=Bug Report" style={linkStyle}>Report a bug</a>
          <Link href="/terms" style={linkStyle}>Terms of service</Link>
          <Link href="/privacy" style={linkStyle}>Privacy policy</Link>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            maxWidth: '1180px',
            margin: '0 auto',
            padding: '1.1rem clamp(1.25rem, 4vw, 2rem)',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          © 2026 BookMyPitch. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
