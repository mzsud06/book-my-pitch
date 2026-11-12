import type { ReactNode } from 'react'

type BadgeVariant = 'peak' | 'offpeak' | 'weekend' | 'neutral' | 'public'

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
    background: 'rgba(23,50,87,0.8)',
    border: '1px solid rgba(23,50,87,1)',
    color: 'var(--green)',
  },
  weekend: {
    background: 'rgba(94,168,255,0.12)',
    border: '1px solid rgba(94,168,255,0.3)',
    color: '#5EA8FF',
  },
  neutral: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  public: {
    background: 'rgba(228,255,58,0.12)',
    border: '1px solid rgba(228,255,58,0.3)',
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
