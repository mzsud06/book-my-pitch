// TEST 3: Payment trigger fires exactly once.
// The trigger-payments route has an idempotency guard: if the session is already
// 'confirmed', it returns early without re-charging Stripe.
// This prevents double-charging if the endpoint is called multiple times.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: { create: vi.fn(), capture: vi.fn(), cancel: vi.fn() },
    refunds: { create: vi.fn() },
  },
  PLATFORM_FEE_PENCE: 50,
  STRIPE_PROCESSING_PENCE: 30,
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { POST as triggerPayments } from '@/app/api/trigger-payments/route'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import * as Sentry from '@sentry/nextjs'

const INTERNAL_SECRET = 'test-secret'
const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const SLOT_ID = '22222222-2222-2222-2222-222222222222'
const VENUE_ID = '33333333-3333-3333-3333-333333333333'

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const mockSlotData = {
  id: SLOT_ID,
  price: 30,
  venue_id: VENUE_ID,
  pitches: { id: 'pitch-1', name: 'Main Pitch', format: '5-a-side', surface: '4G', max_players: 10, peak_price: 50, offpeak_price: 30, weekend_price: 40 },
  start_time: '19:00',
  end_time: '20:00',
  date: FUTURE_DATE,
}

function makePlayer(i: number) {
  return {
    id: `player-${i}`,
    name: `Player ${i}`,
    session_id: SESSION_ID,
    user_id: null,
    stripe_customer_id: `cus_${i}`,
    stripe_payment_method_id: `pm_${i}`,
    phone: null,
  }
}

function makeRequest() {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ sessionId: SESSION_ID }),
  }) as unknown as NextRequest
}

describe('trigger-payments: fires exactly once (idempotency guard)', () => {
  beforeEach(() => {
    process.env.INTERNAL_SECRET = INTERNAL_SECRET
    vi.clearAllMocks()
  })

  it('charges all players on first call, then refuses to re-charge on second call', async () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', slots: mockSlotData }],
      venues: [{ id: VENUE_ID, stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players,
      bookings: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({ id: 'pi_test', status: 'requires_capture' } as any)
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({ status: 'succeeded' } as any)

    // ── First call ────────────────────────────────────────────────────────
    const res1 = await triggerPayments(makeRequest())
    const body1 = await res1.json()

    expect(res1.status).toBe(200)
    expect(body1.success).toBe(true)
    expect(db._tables.sessions[0].status).toBe('confirmed')
    const stripeCallsAfterFirst = vi.mocked(stripe.paymentIntents.create).mock.calls.length
    expect(stripeCallsAfterFirst).toBe(10)

    // ── Second call (retry / accidental duplicate) ─────────────────────
    const res2 = await triggerPayments(makeRequest())
    const body2 = await res2.json()

    expect(res2.status).toBe(200)
    expect(body2.message).toBe('Already confirmed')

    // Stripe must NOT have been called again
    expect(vi.mocked(stripe.paymentIntents.create).mock.calls.length).toBe(stripeCallsAfterFirst)
  })

  it('rejects the call without valid INTERNAL_SECRET', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'wrong-secret' },
      body: JSON.stringify({ sessionId: SESSION_ID }),
    }) as unknown as NextRequest

    const res = await triggerPayments(req)
    expect(res.status).toBe(401)
    expect(vi.mocked(stripe.paymentIntents.create)).not.toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
      expect.stringContaining('internal_secret_mismatch'),
      expect.anything()
    )
  })

  it('rejects and logs a security event when INTERNAL_SECRET is not configured at all', async () => {
    delete process.env.INTERNAL_SECRET
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify({ sessionId: SESSION_ID }),
    }) as unknown as NextRequest

    const res = await triggerPayments(req)
    expect(res.status).toBe(401)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
      expect.stringContaining('internal_secret_not_configured'),
      expect.anything()
    )
  })

  it('returns 400 if not enough players are present to trigger payments', async () => {
    // Only 5 players but max_players is 10 → expectedTotal = 10 → guard fires
    const players = Array.from({ length: 5 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', slots: mockSlotData }],
      venues: [{ id: VENUE_ID, stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players,
      bookings: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)

    const res = await triggerPayments(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Not enough players')
    expect(vi.mocked(stripe.paymentIntents.create)).not.toHaveBeenCalled()
    // Session stays filling
    expect(db._tables.sessions[0].status).toBe('filling')
  })
})
