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
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-label)',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: color === 'green' ? 'var(--green)' : 'var(--text-secondary)',
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  )
}
