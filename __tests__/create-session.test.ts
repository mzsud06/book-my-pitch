// POST /api/sessions must refuse to create a session for a slot belonging
// to a venue that hasn't been manually approved (or whose Stripe onboarding
// isn't verified) — this is the actual gate that stops a self-serve owner
// from listing a fake venue and having players book/pay before anyone's
// vetted it.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn().mockReturnValue(true), getClientIp: vi.fn().mockReturnValue('test-ip') }))

import { POST as createSession } from '@/app/api/sessions/route'
import { createClient } from '@/lib/supabase/server'

const USER_ID = 'organiser-1'
const SLOT_ID = '22222222-2222-2222-2222-222222222222'
const VENUE_ID = '33333333-3333-3333-3333-333333333333'

function makeRequest(body: object) {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const VALID_BODY = { slotId: SLOT_ID, name: 'Alice', phone: null, gameType: 'private' }

beforeEach(() => vi.clearAllMocks())

describe('POST /api/sessions: venue approval gate', () => {
  it('rejects creating a session for a venue that is not admin_approved', async () => {
    const db = createMockDb({
      slots: [{ id: SLOT_ID, venue_id: VENUE_ID }],
      venues: [{ id: VENUE_ID, admin_approved: false, stripe_onboarding_complete: true }],
      sessions: [],
    }, { id: USER_ID })
    vi.mocked(createClient).mockResolvedValue(db as any)

    const res = await createSession(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('This venue is not currently accepting bookings')
    expect(db._tables.sessions.length).toBe(0)
  })

  it('rejects creating a session for a venue whose Stripe onboarding is not complete, even if approved', async () => {
    const db = createMockDb({
      slots: [{ id: SLOT_ID, venue_id: VENUE_ID }],
      venues: [{ id: VENUE_ID, admin_approved: true, stripe_onboarding_complete: false }],
      sessions: [],
    }, { id: USER_ID })
    vi.mocked(createClient).mockResolvedValue(db as any)

    const res = await createSession(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    expect(db._tables.sessions.length).toBe(0)
  })

  it('allows creating a session for a fully approved and onboarded venue', async () => {
    const db = createMockDb({
      slots: [{ id: SLOT_ID, venue_id: VENUE_ID }],
      venues: [{ id: VENUE_ID, admin_approved: true, stripe_onboarding_complete: true }],
      sessions: [],
    }, { id: USER_ID })
    vi.mocked(createClient).mockResolvedValue(db as any)

    const res = await createSession(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(typeof body.sessionId).toBe('string')
    expect(db._tables.sessions.length).toBe(1)
  })
})
