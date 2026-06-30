import * as Sentry from '@sentry/nextjs'
import type { ErrorEvent } from '@sentry/core'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubPii(event) as ErrorEvent
  },
})

const PHONE_RE = /\+\d{7,15}/g
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const CARD_RE = /\b(?!pm_|cus_|sub_|pi_|seti_)(\d{13,19})\b/g

function scrubString(s: string): string {
  return s
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, (m) => `+***${m.slice(-4)}`)
    .replace(CARD_RE, '[card]')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scrubPii(obj: any): any {
  if (typeof obj === 'string') return scrubString(obj)
  if (Array.isArray(obj)) return obj.map(scrubPii)
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) out[k] = scrubPii(v)
    return out
  }
  return obj
}
