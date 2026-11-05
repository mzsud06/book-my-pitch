import type { ReactNode } from 'react'
import { Eyebrow } from './Eyebrow'

interface SectionHeadingProps {
  eyebrow?: string
  heading: ReactNode
  sub?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({
  eyebrow,
  heading,
  sub,
  align = 'left',
  className = '',
}: SectionHeadingProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        textAlign: align,
        alignItems: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-h2)',
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          color: 'var(--text)',
          margin: 0,
        }}
      >
        {heading}
      </h2>
      {sub && (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.0625rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            margin: 0,
            maxWidth: '52ch',
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
