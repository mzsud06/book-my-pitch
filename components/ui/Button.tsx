import type { ReactNode, ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  arrow?: boolean
  children: ReactNode
}

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  fontFamily: 'var(--font-display)', fontStretch: '75%',
  fontWeight: 800,
  letterSpacing: '0.01em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  transition: 'background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out',
  userSelect: 'none',
}

const variants: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--brand)',
    color: '#FFFFFF',
  },
  secondary: {
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
}

const sizes: Record<Size, React.CSSProperties> = {
  sm: { fontSize: '15px', padding: '0.55rem 1rem' },
  md: { fontSize: '17px', padding: '0.65rem 1.3rem' },
  lg: { fontSize: '19px', padding: '0.85rem 1.7rem' },
}

export function Button({
  variant = 'primary',
  size = 'md',
  arrow = false,
  children,
  style,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`bmp-btn bmp-btn-${variant} ${className ?? ''}`}
      style={{ ...base, ...variants[variant], ...sizes[size], ...style }}
      {...props}
    >
      {children}
      {arrow && <span aria-hidden="true" style={{ marginLeft: '2px' }}>→</span>}
    </button>
  )
}
