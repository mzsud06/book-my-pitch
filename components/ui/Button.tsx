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
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
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
    background: 'var(--green)',
    color: 'var(--black)',
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
  sm: { fontSize: '13px', padding: '0.5rem 1rem' },
  md: { fontSize: '14px', padding: '0.625rem 1.25rem' },
  lg: { fontSize: '15px', padding: '0.75rem 1.5rem' },
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
