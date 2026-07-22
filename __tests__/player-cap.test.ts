// TEST 2: Player cap is never exceeded.
// Private/open sessions cap at max_players (10).

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

import { POST as joinSession } from '@/app/api/join/route'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const SLOT_ID = '22222222-2222-2222-2222-222222222222'
const VENUE_ID = '33333333-3333-3333-3333-333333333333'
const ORGANISER_ID = 'organiser-001'

const mockSlot = {
  id: SLOT_ID,
  price: 30,
  venue_id: VENUE_ID,
  pitches: { id: 'pitch-1', name: 'Main Pitch', format: '5-a-side', surface: '4G', max_players: 10, peak_price: 50, offpeak_price: 30, weekend_price: 40 },
}

function makePlayer(i: number, sessionId = SESSION_ID, userId?: string) {
  return {
    id: `player-${i}`,
    name: `Player ${i}`,
    session_id: sessionId,
    user_id: userId ?? null,
    stripe_customer_id: `cus_${i}`,
    stripe_payment_method_id: `pm_${i}`,
    phone: null,
  }
}

function makeRequest(body: object) {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const joinBody = (sessionId = SESSION_ID) => ({
  slotId: SLOT_ID,
  sessionId,
  isOrganiser: false,
  name: 'Extra Player',
  phone: null,
  paymentMethodId: 'pm_new',
  customerId: 'cus_new',
})

function setupStripeOk(customerId = 'cus_new') {
  vi.mocked(stripe.paymentMethods.retrieve).mockResolvedValue({
    id: 'pm_new',
    customer: customerId,
  } as any)
}

// ── Private / open 10-player cap ─────────────────────────────────────────

describe('private/open session: hard cap at max_players (10)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an 11th player when session already has 10 (including organiser)', async () => {
    // Organiser IS in the players table so joinCap stays at 10 (not 9)
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer(i + 1, SESSION_ID, i === 0 ? ORGANISER_ID : undefined),
    )
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: ORGANISER_ID,
        game_type: 'private',
      }],
      players,
    })
    const authDb = createMockDb({ slots: [mockSlot] }, { id: 'new-user' })
    vi.mocked(createClient).mockResolvedValue(authDb as any)
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    setupStripeOk()

    const res = await joinSession(makeRequest(joinBody()))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe('Session is full')
    // Players table must remain at 10
    expect(svcDb._tables.players.length).toBe(10)
  })

  it('allows a player when session has 9 (organiser already in, slot not yet full)', async () => {
    const players = Array.from({ length: 9 }, (_, i) =>
      makePlayer(i + 1, SESSION_ID, i === 0 ? ORGANISER_ID : undefined),
    )
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: ORGANISER_ID,
        game_type: 'private',
      }],
      slots: [mockSlot],
      players,
    })
    const authDb = createMockDb({ slots: [mockSlot] }, { id: 'new-user' })
    vi.mocked(createClient).mockResolvedValue(authDb as any)
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    setupStripeOk()
    // 10th player triggers payments — mock Stripe to return success so the
    // route doesn't error out, but we only care about the cap logic here
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({ status: 'succeeded' } as any)

    const res = await joinSession(makeRequest(joinBody()))

    expect(res.status).toBe(200)
    expect(svcDb._tables.players.length).toBe(10)
  })
})
