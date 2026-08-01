import * as Sentry from '@sentry/nextjs'

// Centralized security-event logging — every deliberate-abuse signal (rate
// limit trips, failed admin/internal-secret auth, identity mismatches) goes
// through here with a consistent tag so it's greppable in Vercel's logs, and
// also lands in Sentry as a searchable message (not an exception) so it
// survives past the log retention window and could back an alert rule.
// PII scrubbing happens automatically via the shared Sentry `beforeSend` hook
// (sentry.server.config.ts) — no need to redact here.
export function logSecurityEvent(event: string, details: Record<string, unknown> = {}): void {
  console.warn(`[security] ${event}`, details)
  Sentry.captureMessage(`[security] ${event}`, {
    level: 'warning',
    tags: { security_event: event },
    extra: details,
  })
}
