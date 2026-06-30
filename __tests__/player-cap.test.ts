// TEST 2: Player cap is never exceeded.
// Private/open sessions cap at max_players (10). LFO/matched sessions cap at 5 per team.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentMethods: { retrieve: vi.fn(), detach: vi.fn() },
    paymentIntents: { create: vi.fn() },
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
const LFO_SESSION_ID = '44444444-4444-4444-4444-444444444444'
const CHALLENGER_SESSION_ID = '55555555-5555-5555-5555-555555555555'
const SLOT_ID = '22222222-2222-2222-2222-222222222222'
const VENUE_ID = '33333333-3333-3333-3333-333333333333'
const ORGANISER_ID = 'organiser-001'

const mockSlot = {
  id: SLOT_ID,
  type: 'offpeak',
  price: 30,
  venue_id: VENUE_ID,
  max_players: 10,
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
        matched_session_id: null,
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
        matched_session_id: null,
        game_type: 'private',
      }],
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

// ── LFO / matched session 5-per-team cap ─────────────────────────────────

describe('LFO matched session: hard cap at 5 players per team', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a 6th player on the challenger team when 5 are already in', async () => {
    // Challenger session points at LFO (matched_session_id set) → isTeamSession = true → cap = 5
    const players = Array.from({ length: 5 }, (_, i) => makePlayer(i + 1, CHALLENGER_SESSION_ID))
    const svcDb = createMockDb({
      sessions: [{
        id: CHALLENGER_SESSION_ID,
        status: 'filling',
        organiser_id: ORGANISER_ID,
        matched_session_id: LFO_SESSION_ID,
        game_type: 'private',
      }],
      players,
    })
    const authDb = createMockDb({ slots: [mockSlot] }, { id: 'new-user' })
    vi.mocked(createClient).mockResolvedValue(authDb as any)
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    setupStripeOk()

    const res = await joinSession(makeRequest(joinBody(CHALLENGER_SESSION_ID)))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('This team is already full.')
    expect(svcDb._tables.players.length).toBe(5)
  })

  it('rejects a 6th player on the LFO team when game_type is looking_for_opposition', async () => {
    // Unclaimed LFO session (no matched_session_id yet, game_type = 'looking_for_opposition')
    // isTeamSession = true because game_type is lfo → cap = 5
    const players = Array.from({ length: 5 }, (_, i) => makePlayer(i + 1, LFO_SESSION_ID))
    const svcDb = createMockDb({
      sessions: [{
        id: LFO_SESSION_ID,
        status: 'filling',
        organiser_id: ORGANISER_ID,
        matched_session_id: null,
        game_type: 'looking_for_opposition',
      }],
      players,
    })
    const authDb = createMockDb({ slots: [mockSlot] }, { id: 'new-user' })
    vi.mocked(createClient).mockResolvedValue(authDb as any)
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    setupStripeOk()

    const res = await joinSession(makeRequest(joinBody(LFO_SESSION_ID)))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('This team is already full.')
    expect(svcDb._tables.players.length).toBe(5)
  })

  it('allows a 5th player when only 4 are in the LFO team', async () => {
    const players = Array.from({ length: 4 }, (_, i) => makePlayer(i + 1, LFO_SESSION_ID))
    const svcDb = createMockDb({
      sessions: [{
        id: LFO_SESSION_ID,
        status: 'filling',
        organiser_id: ORGANISER_ID,
        matched_session_id: null,
        game_type: 'looking_for_opposition',
      }],
      players,
    })
    const authDb = createMockDb({ slots: [mockSlot] }, { id: 'new-user' })
    vi.mocked(createClient).mockResolvedValue(authDb as any)
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    setupStripeOk()

    const res = await joinSession(makeRequest(joinBody(LFO_SESSION_ID)))

    expect(res.status).toBe(200)
    expect(svcDb._tables.players.length).toBe(5)
  })
})
