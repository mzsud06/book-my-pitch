import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

import { checkRateLimit } from '@/lib/rateLimit'
import * as Sentry from '@sentry/nextjs'

describe('checkRateLimit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows requests under the limit and blocks once the limit is hit', () => {
    const key = `test-key-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000)).toBe(true)
    }
    expect(checkRateLimit(key, 3, 60_000)).toBe(false)
  })

  it('logs a security event to Sentry the first time a key trips', () => {
    const key = `test-key-${Math.random()}`
    checkRateLimit(key, 1, 60_000) // consumes the only allowed slot
    expect(checkRateLimit(key, 1, 60_000)).toBe(false) // trips here

    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1)
    const [message, opts] = vi.mocked(Sentry.captureMessage).mock.calls[0]
    expect(message).toContain('rate_limit_exceeded')
    expect((opts as any).tags.security_event).toBe('rate_limit_exceeded')
  })

  it('does not re-log on every subsequent blocked request within the cooldown', () => {
    const key = `test-key-${Math.random()}`
    checkRateLimit(key, 1, 60_000)
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key, 1, 60_000)).toBe(false)
    }
    // One log for the whole burst, not one per blocked attempt.
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1)
  })

  it('does not log anything for a key that never trips', () => {
    const key = `test-key-${Math.random()}`
    checkRateLimit(key, 5, 60_000)
    checkRateLimit(key, 5, 60_000)
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })
})
