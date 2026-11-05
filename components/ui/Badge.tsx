import type { ReactNode } from 'react'

type BadgeVariant = 'peak' | 'offpeak' | 'weekend' | 'neutral' | 'public' | 'hot' | 'solid'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const styles: Record<BadgeVariant, React.CSSProperties> = {
  hot: { background: 'var(--coral)', border: '1px solid var(--coral)', color: '#FFFFFF' },
  solid: { background: 'var(--green)', border: '1px solid var(--green)', color: '#FFFFFF' },
  peak: {
    background: 'rgba(138,90,0,0.10)',
    border: '1px solid rgba(138,90,0,0.30)',
    color: 'var(--amber)',
  },
  offpeak: {
    background: 'rgba(31,59,255,0.08)',
    border: '1px solid rgba(31,59,255,0.30)',
    color: 'var(--green)',
  },
  weekend: {
    background: 'rgba(11,17,48,0.06)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text)',
  },
  neutral: {
    background: 'rgba(11,17,48,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  public: {
    background: 'rgba(31,59,255,0.12)',
    border: '1px solid rgba(31,59,255,0.3)',
    color: 'var(--green)',
  },
}

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '4px 11px',
  borderRadius: 'var(--radius-full)',
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0',
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
