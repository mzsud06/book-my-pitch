import type { ReactNode } from 'react'

type BadgeVariant = 'peak' | 'offpeak' | 'weekend' | 'neutral' | 'public'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const styles: Record<BadgeVariant, React.CSSProperties> = {
  peak: {
    background: 'rgba(255,79,26,0.10)',
    border: '1px solid rgba(255,79,26,0.22)',
    color: '#B83208',
  },
  offpeak: {
    background: 'var(--pitch-green)',
    border: '1px solid rgba(198,244,50,0.6)',
    color: '#3F5200',
  },
  weekend: {
    background: 'rgba(16,20,24,0.07)',
    border: '1px solid rgba(16,20,24,0.14)',
    color: 'var(--ink)',
  },
  neutral: {
    background: 'rgba(16,20,24,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  public: {
    background: 'var(--ink)',
    border: '1px solid var(--ink)',
    color: '#FFFFFF',
  },
}

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '3px 10px',
  borderRadius: 'var(--radius-full)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  lineHeight: 1.5,
  fontFamily: 'var(--font-sans)',
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span className={className} style={{ ...base, ...styles[variant] }}>
      {children}
    </span>
  )
}
