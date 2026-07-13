// TEST 1: Session only confirmed after payment succeeds.
// Tests the trigger-payments route which is the authoritative payment→confirmation path,
// and the join route's Stripe PM ownership check which gates player insertion.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentMethods: { retrieve: vi.fn(), detach: vi.fn() },
    paymentIntents: { create: vi.fn() },
    refunds: { create: vi.fn() },
  },
  PLATFORM_FEE_PENCE: 50,
  STRIPE_PROCESSING_PENCE: 30,
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { POST as triggerPayments } from '@/app/api/trigger-payments/route'
import { POST as joinSession } from '@/app/api/join/route'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const INTERNAL_SECRET = 'test-secret'
const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const SLOT_ID = '22222222-2222-2222-2222-222222222222'
const VENUE_ID = '33333333-3333-3333-3333-333333333333'

const mockSlotData = {
  id: SLOT_ID,
  type: 'offpeak' as const,
  price: 30,
  venue_id: VENUE_ID,
  max_players: 10,
  start_time: '19:00',
  end_time: '20:00',
  date: '2026-07-15',
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

function makeRequest(body: object, extraHeaders: Record<string, string> = {}) {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

// ── Trigger-payments tests ─────────────────────────────────────────────────

describe('trigger-payments: payment → session confirmed', () => {
  beforeEach(() => {
    process.env.INTERNAL_SECRET = INTERNAL_SECRET
    vi.clearAllMocks()
  })

  it('confirms session and creates booking when all 10 payments succeed', async () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', slots: mockSlotData }],
      venues: [{ id: VENUE_ID, stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players,
      bookings: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({ status: 'succeeded' } as any)

    const req = makeRequest({ sessionId: SESSION_ID }, { 'x-internal-secret': INTERNAL_SECRET })
    const res = await triggerPayments(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    const session = db._tables.sessions.find(s => s.id === SESSION_ID)
    expect(session?.status).toBe('confirmed')

    expect(db._tables.bookings?.length).toBe(1)
    expect(vi.mocked(stripe.paymentIntents.create)).toHaveBeenCalledTimes(10)
  })

  it('does NOT confirm session when any payment fails — session stays filling', async () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', slots: mockSlotData }],
      venues: [{ id: VENUE_ID, stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players,
      bookings: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create)
      .mockRejectedValueOnce(new Error('Card declined'))
      .mockResolvedValue({ status: 'succeeded' } as any)

    const req = makeRequest({ sessionId: SESSION_ID }, { 'x-internal-secret': INTERNAL_SECRET })
    const res = await triggerPayments(req)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.success).toBe(false)

    const session = db._tables.sessions.find(s => s.id === SESSION_ID)
    expect(session?.status).toBe('filling')

    expect(db._tables.bookings?.length ?? 0).toBe(0)
  })
})

// ── Join route: Stripe PM ownership gates player insertion ─────────────────

describe('join: Stripe PM verification gates player insertion', () => {
  const USER_ID = 'user-aaa'
  const PM_ID = 'pm_test001'
  const CUSTOMER_ID = 'cus_test001'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT insert player when PM belongs to a different customer', async () => {
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: 'organiser-xyz',
        game_type: 'private',
      }],
      players: [],
    })
    const authDb = createMockDb({ slots: [mockSlotData] }, { id: USER_ID })

    vi.mocked(createClient).mockResolvedValue(authDb as any)
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    // PM belongs to a different customer — ownership check will fail
    vi.mocked(stripe.paymentMethods.retrieve).mockResolvedValue({
      id: PM_ID,
      customer: 'cus_someone_else',
    } as any)

    const req = makeRequest({
      slotId: SLOT_ID,
      sessionId: SESSION_ID,
      isOrganiser: false,
      name: 'Test Player',
      phone: null,
      paymentMethodId: PM_ID,
      customerId: CUSTOMER_ID,
    })
    const res = await joinSession(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid payment details')
    expect(svcDb._tables.players.length).toBe(0)
  })

  it('inserts player when PM ownership check passes', async () => {
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: 'organiser-xyz',
        game_type: 'private',
      }],
      players: [],
    })
    const authDb = createMockDb({ slots: [mockSlotData] }, { id: USER_ID })

    vi.mocked(createClient).mockResolvedValue(authDb as any)
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    // PM belongs to the claimed customer — ownership check passes
    vi.mocked(stripe.paymentMethods.retrieve).mockResolvedValue({
      id: PM_ID,
      customer: CUSTOMER_ID,
    } as any)

    const req = makeRequest({
      slotId: SLOT_ID,
      sessionId: SESSION_ID,
      isOrganiser: false,
      name: 'Test Player',
      phone: null,
      paymentMethodId: PM_ID,
      customerId: CUSTOMER_ID,
    })
    const res = await joinSession(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sessionId).toBe(SESSION_ID)
    expect(svcDb._tables.players.length).toBe(1)
    expect(svcDb._tables.players[0].stripe_payment_method_id).toBe(PM_ID)
  })
})
