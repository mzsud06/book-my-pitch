// /api/admin/approve-venue had no dedicated test coverage. Covers the admin
// gate (and that a failed attempt is logged as a security event) plus the
// actual approve/revoke behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ isAdminEmail: (email: string | null | undefined) => email === 'admin@bookmypitch.uk' }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn().mockReturnValue(true), getClientIp: vi.fn().mockReturnValue('test-ip') }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

import { POST as approveVenue } from '@/app/api/admin/approve-venue/route'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'
import * as Sentry from '@sentry/nextjs'

const VENUE_ID = '55555555-5555-5555-5555-555555555555'

function makeRequest(body: object, user: { id: string; email: string } | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as any)

  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const ADMIN_USER = { id: 'admin-1', email: 'admin@bookmypitch.uk' }
const NON_ADMIN_USER = { id: 'user-1', email: 'someone@example.com' }

beforeEach(() => vi.clearAllMocks())

describe('POST /api/admin/approve-venue', () => {
  it('rejects an unauthenticated request and logs it as a security event', async () => {
    const res = await approveVenue(makeRequest({ venueId: VENUE_ID, approved: true }, null))
    expect(res.status).toBe(403)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
      expect.stringContaining('admin_auth_failed'),
      expect.objectContaining({ tags: { security_event: 'admin_auth_failed' } })
    )
  })

  it('rejects a logged-in but non-admin user and logs it as a security event', async () => {
    const res = await approveVenue(makeRequest({ venueId: VENUE_ID, approved: true }, NON_ADMIN_USER))
    expect(res.status).toBe(403)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
      expect.stringContaining('admin_auth_failed'),
      expect.anything()
    )
  })

  it('does not log a security event for a genuine admin', async () => {
    const svcDb = createMockDb({ venues: [{ id: VENUE_ID, admin_approved: false }] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await approveVenue(makeRequest({ venueId: VENUE_ID, approved: true }, ADMIN_USER))
    expect(res.status).toBe(200)
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('approves a venue for a genuine admin', async () => {
    const svcDb = createMockDb({ venues: [{ id: VENUE_ID, admin_approved: false }] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await approveVenue(makeRequest({ venueId: VENUE_ID, approved: true }, ADMIN_USER))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(svcDb._tables.venues[0].admin_approved).toBe(true)
  })

  it('rejects an invalid venue id', async () => {
    const res = await approveVenue(makeRequest({ venueId: 'not-a-uuid', approved: true }, ADMIN_USER))
    expect(res.status).toBe(400)
  })

  it('rejects a non-boolean approved value', async () => {
    const res = await approveVenue(makeRequest({ venueId: VENUE_ID, approved: 'yes' }, ADMIN_USER))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValueOnce(false)
    const res = await approveVenue(makeRequest({ venueId: VENUE_ID, approved: true }, ADMIN_USER))
    expect(res.status).toBe(429)
  })
})
