import type { ReactNode } from 'react'

type BadgeVariant = 'peak' | 'offpeak' | 'weekend' | 'neutral' | 'public'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const styles: Record<BadgeVariant, React.CSSProperties> = {
  peak: {
    background: 'rgba(138,90,0,0.10)',
    border: '1px solid rgba(138,90,0,0.30)',
    color: 'var(--amber)',
  },
  offpeak: {
    background: 'rgba(20,80,45,0.08)',
    border: '1px solid rgba(20,80,45,0.30)',
    color: 'var(--green)',
  },
  weekend: {
    background: 'rgba(31,36,32,0.06)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text)',
  },
  neutral: {
    background: 'rgba(31,36,32,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  public: {
    background: 'rgba(20,80,45,0.12)',
    border: '1px solid rgba(20,80,45,0.3)',
    color: 'var(--green)',
  },
}

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '3px 10px',
  borderRadius: 'var(--radius-full)',
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '0.02em',
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
