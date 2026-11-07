import type { CSSProperties } from 'react'

export type SquadStatus = 'filling' | 'confirmed' | 'expired'

interface SquadStripProps {
  filled: number
  total: number
  status?: SquadStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// A row of numbered shirt slots. Joined slots are orange (money held).
// When the game confirms, every joined slot flips to volt.
// Purely presentational: it renders whatever counts it is given.
export function SquadStrip({ filled, total, status = 'filling', size = 'md', className = '' }: SquadStripProps) {
  const safeTotal = Math.max(1, total)
  const safeFilled = Math.min(Math.max(0, filled), safeTotal)
  const cls = [
    'squad',
    size === 'sm' ? 'squad--sm' : size === 'lg' ? 'squad--lg' : '',
    status === 'confirmed' ? 'is-confirmed' : '',
    status === 'expired' ? 'is-expired' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      style={{ '--n': safeTotal } as CSSProperties}
      role="img"
      aria-label={`${safeFilled} of ${safeTotal} spots filled${status === 'confirmed' ? ', game confirmed' : ''}`}
    >
      {Array.from({ length: safeTotal }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`squad-slot${i < safeFilled ? ' is-filled' : ''}`}
          style={{ '--i': i } as CSSProperties}
        >
          {i + 1}
        </span>
      ))}
    </div>
  )
}

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="3" y="7" width="10" height="7" rx="1.8" fill="currentColor" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ConfirmedStamp({ animated = false }: { animated?: boolean }) {
  return (
    <span className={`stamp-confirmed${animated ? ' is-animated' : ''}`}>
      <CheckIcon size={13} /> Confirmed
    </span>
  )
}
