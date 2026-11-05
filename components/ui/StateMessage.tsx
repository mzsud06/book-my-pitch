import type { ReactNode } from 'react'

interface StateMessageProps {
  title: string
  body?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'error'
  role?: 'status' | 'alert'
}

/** Empty, error and loading messages: say what happened, then what to do. */
export function StateMessage({ title, body, action, tone = 'neutral', role }: StateMessageProps) {
  return (
    <div
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${tone === 'error' ? 'rgba(179,38,30,0.35)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: 'clamp(1.75rem, 5vw, 3rem) 1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.6rem',
      }}
    >
      <h2 style={{ fontSize: '1.375rem', lineHeight: 1.25, margin: 0, color: tone === 'error' ? 'var(--red)' : 'var(--text)' }}>{title}</h2>
      {body && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '44ch' }}>{body}</p>}
      {action && <div style={{ marginTop: '0.75rem' }}>{action}</div>}
    </div>
  )
}
