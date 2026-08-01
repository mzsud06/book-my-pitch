import { NextRequest } from 'next/server'
import { logSecurityEvent } from './securityLog'

/**
 * Minimal in-memory sliding-window rate limiter.
 * Per-instance only — resets on redeploy/restart and does not share state
 * across serverless instances. Good enough as a first line of defence against
 * casual abuse; swap for a shared store (e.g. Upstash/Redis) if this needs to
 * hold up across multiple instances.
 */
const buckets = new Map<string, number[]>()

// Last time each key's rate-limit trip was actually logged — a sustained
// flood would otherwise log (and Sentry-report) every single blocked
// request, turning the abuse into a logging flood of its own. One log per
// key per cooldown is enough to know it's happening.
const lastLoggedTrip = new Map<string, number>()
const LOG_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

// Idle-key sweep — keys that haven't been touched in a while are dropped so a
// flood of distinct keys (e.g. spoofed IPs) can't grow the Maps unboundedly.
const STALE_MS = 2 * 60 * 60 * 1000 // 2 hours
const SWEEP_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

let sweepStarted = false
function startSweep() {
  if (sweepStarted) return
  sweepStarted = true
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, timestamps] of buckets) {
      const newest = timestamps[timestamps.length - 1] ?? 0
      if (now - newest > STALE_MS) buckets.delete(key)
    }
    for (const [key, loggedAt] of lastLoggedTrip) {
      if (now - loggedAt > STALE_MS) lastLoggedTrip.delete(key)
    }
  }, SWEEP_INTERVAL_MS)
  timer.unref?.()
}
startSweep()

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const existing = buckets.get(key) ?? []
  const recent = existing.filter(t => now - t < windowMs)

  if (recent.length >= max) {
    buckets.set(key, recent)
    const lastLogged = lastLoggedTrip.get(key) ?? 0
    if (now - lastLogged > LOG_COOLDOWN_MS) {
      lastLoggedTrip.set(key, now)
      logSecurityEvent('rate_limit_exceeded', { key, max, windowMs })
    }
    return false
  }

  recent.push(now)
  buckets.set(key, recent)
  return true
}

export function getClientIp(req: NextRequest): string {
  // x-forwarded-for is a chain of "client, proxy1, proxy2, ...": each hop
  // appends the IP it saw the request come from. The client-supplied value
  // (if any) is always the FIRST entry, and the real client IP as seen by the
  // last trusted hop (e.g. Vercel's edge) is the LAST entry — so the last
  // entry is the one that can't be forged by the client itself.
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(Boolean)
    if (ips.length > 0) return ips[ips.length - 1]
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? 'unknown'
}
