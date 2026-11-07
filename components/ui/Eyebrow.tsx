import type { ReactNode } from 'react'

interface EyebrowProps {
  children: ReactNode
  color?: 'green' | 'secondary'
  className?: string
}

// Small label with an orange pip. Text stays ink/grey so it passes contrast on white.
export function Eyebrow({ children, color = 'green', className = '' }: EyebrowProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-label)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: color === 'green' ? 'var(--text)' : 'var(--text-secondary)',
        lineHeight: 1.4,
      }}
    >
      {color === 'green' && (
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--brand)', flexShrink: 0 }} />
      )}
      {children}
    </span>
  )
}
