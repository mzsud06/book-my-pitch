import type { ReactNode } from 'react'

type BadgeVariant = 'peak' | 'offpeak' | 'neutral' | 'public'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const styles: Record<BadgeVariant, React.CSSProperties> = {
  peak: {
    background: 'rgba(255,184,0,0.12)',
    border: '1px solid rgba(255,184,0,0.25)',
    color: '#FFB800',
  },
  offpeak: {
    background: 'rgba(22,48,31,0.8)',
    border: '1px solid rgba(22,48,31,1)',
    color: 'var(--green)',
  },
  neutral: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  public: {
    background: 'rgba(198,241,53,0.12)',
    border: '1px solid rgba(198,241,53,0.3)',
    color: 'var(--green)',
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
