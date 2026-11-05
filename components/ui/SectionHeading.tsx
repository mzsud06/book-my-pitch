import type { ReactNode } from 'react'

interface SectionHeadingProps {
  eyebrow?: string
  heading: ReactNode
  sub?: ReactNode
  action?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

/** Champz-style: small spaced cobalt label, huge wide all-caps heading, optional link on the right. */
export function SectionHeading({ eyebrow, heading, sub, action, align = 'left', className = '' }: SectionHeadingProps) {
  return (
    <div className={`section-heading ${className}`} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: align === 'center' ? 'center' : 'space-between', gap: '1rem 2rem', flexWrap: 'wrap', textAlign: align }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        {eyebrow && (
          <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--green)' }}>{eyebrow}</span>
        )}
        <h2 style={{ fontSize: 'var(--text-h2)', margin: 0, color: 'var(--text)', maxWidth: '18ch' }}>{heading}</h2>
        {sub && <p style={{ fontSize: '1.0625rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, maxWidth: '52ch' }}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}
