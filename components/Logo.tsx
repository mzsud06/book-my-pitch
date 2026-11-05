// BookMyPitch mark: chartreuse ball on a cobalt rounded square.
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="48" height="48" rx="13" fill="#1F3BFF" />
      <circle cx="24" cy="24" r="13.5" fill="#D7FF3D" />
      <path d="M24 17.6l5.4 3.9-2.1 6.3h-6.6l-2.1-6.3z" fill="#1F3BFF" />
      <path d="M24 17.6V10.6M29.4 21.5l6.6-2.2M27.3 27.8l4 5.6M20.7 27.8l-4 5.6M18.6 21.5l-6.6-2.2" stroke="#1F3BFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ size = 40, hideWordmarkOnMobile = false }: { size?: number; hideWordmarkOnMobile?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <LogoMark size={size} />
      <span
        className={hideWordmarkOnMobile ? 'logo-wordmark logo-wordmark-hide-sm' : 'logo-wordmark'}
        style={{ fontFamily: 'var(--font-display)', fontStretch: '125%', fontWeight: 900, fontSize: '17px', letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1, textTransform: 'uppercase' }}
      >
        Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
      </span>
    </span>
  )
}
