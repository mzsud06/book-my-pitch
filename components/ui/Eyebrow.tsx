import type { ReactNode } from 'react'

interface EyebrowProps {
  children: ReactNode
  color?: 'green' | 'secondary'
  className?: string
}

export function Eyebrow({ children, color = 'green', className = '' }: EyebrowProps) {
  return (
    <span
      className={className}
      style={{
        display: 'block',
        fontFamily: 'var(--font-condensed)',
        fontSize: '0.95rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: color === 'green' ? 'var(--green)' : 'var(--text-secondary)',
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  )
}
