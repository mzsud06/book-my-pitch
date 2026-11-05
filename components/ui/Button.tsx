import type { ReactNode, ButtonHTMLAttributes } from 'react'

// primary = chartreuse accent (main action, one per view)
// brand   = cobalt (secondary strong actions: Join game, Sign up)
// secondary = white outline, ghost = text only
type Variant = 'primary' | 'brand' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  arrow?: boolean
  block?: boolean
  children: ReactNode
}

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: 'var(--font-sans)',
  fontWeight: 700,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-lg)',
  userSelect: 'none',
}

const variants: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--acid)', color: 'var(--ink)' },
  brand: { background: 'var(--green)', color: '#FFFFFF' },
  secondary: { background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border-strong)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)' },
}

const sizes: Record<Size, React.CSSProperties> = {
  sm: { fontSize: '15px', padding: '0 1.1rem', minHeight: '44px' },
  md: { fontSize: '16px', padding: '0 1.35rem', minHeight: '48px' },
  lg: { fontSize: '17px', padding: '0 1.75rem', minHeight: '56px' },
}

export function Button({ variant = 'primary', size = 'md', arrow = false, block = false, children, style, className, ...props }: ButtonProps) {
  return (
    <button
      className={`bmp-btn bmp-btn-${variant} ${className ?? ''}`}
      style={{ ...base, ...variants[variant], ...sizes[size], ...(block ? { width: '100%' } : {}), ...style }}
      {...props}
    >
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  )
}
