// TEST 4: Leave / cancel cleans up correctly.
// Verifies that leaving removes the player row, last-player-leave auto-cancels
// open/private sessions, and cancelled sessions have no orphaned player rows.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentMethods: { detach: vi.fn() },
  },
  PLATFORM_FEE_PENCE: 50,
  STRIPE_PROCESSING_PENCE: 30,
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { POST as leaveSession } from '@/app/api/leave/route'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const USER_A = 'user-aaaa-aaaa'
const USER_B = 'user-bbbb-bbbb'

function makeRequest(body: object, userId: string | null = USER_A) {
  // Auth client returns the acting user
  const authDb = createMockDb({}, userId ? { id: userId } : null)
  vi.mocked(createClient).mockResolvedValue(authDb as any)

  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('leave: player row is removed on leave', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes the leaving player row and the session keeps other players', async () => {
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: null,
        organiser_name: null,
        organiser_phone: null,
        game_type: 'private',
      }],
      players: [
        { id: 'p-1', session_id: SESSION_ID, user_id: USER_A, name: 'Alice', phone: null, stripe_payment_method_id: 'pm_a', stripe_customer_id: 'cus_a' },
        { id: 'p-2', session_id: SESSION_ID, user_id: USER_B, name: 'Bob', phone: null, stripe_payment_method_id: 'pm_b', stripe_customer_id: 'cus_b' },
      ],
      messages: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(stripe.paymentMethods.detach).mockResolvedValue({} as any)

    const req = makeRequest({ sessionId: SESSION_ID })
    const res = await leaveSession(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    // Alice's row removed, Bob remains
    expect(svcDb._tables.players.length).toBe(1)
    expect(svcDb._tables.players[0].user_id).toBe(USER_B)

    // Session still filling (not cancelled — players remain)
    expect(svcDb._tables.sessions[0].status).toBe('filling')

    // Stripe PM detached
    expect(vi.mocked(stripe.paymentMethods.detach)).toHaveBeenCalledWith('pm_a')
  })
})

describe('leave: last player leaving auto-cancels open/private sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets session status to cancelled when the last player leaves an open session', async () => {
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: null,
        organiser_name: null,
        organiser_phone: null,
        game_type: 'open',
      }],
      players: [
        { id: 'p-1', session_id: SESSION_ID, user_id: USER_A, name: 'Alice', phone: null, stripe_payment_method_id: 'pm_a', stripe_customer_id: 'cus_a' },
      ],
      messages: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(stripe.paymentMethods.detach).mockResolvedValue({} as any)

    const req = makeRequest({ sessionId: SESSION_ID })
    const res = await leaveSession(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    expect(svcDb._tables.sessions[0].status).toBe('cancelled')
    expect(svcDb._tables.sessions[0].is_public).toBe(false)
  })

  it('sets session status to cancelled when the last player leaves a private session', async () => {
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: null,
        organiser_name: null,
        organiser_phone: null,
        game_type: 'private',
      }],
      players: [
        { id: 'p-1', session_id: SESSION_ID, user_id: USER_A, name: 'Alice', phone: null, stripe_payment_method_id: 'pm_a', stripe_customer_id: 'cus_a' },
      ],
      messages: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(stripe.paymentMethods.detach).mockResolvedValue({} as any)

    const req = makeRequest({ sessionId: SESSION_ID })
    const res = await leaveSession(req)

    expect(res.status).toBe(200)
    expect(svcDb._tables.sessions[0].status).toBe('cancelled')
  })
})

describe('leave: no orphaned player rows after session cancel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('player row is deleted before session is cancelled — no orphans remain', async () => {
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'filling',
        organiser_id: null,
        organiser_name: null,
        organiser_phone: null,
        game_type: 'private',
      }],
      players: [
        { id: 'p-1', session_id: SESSION_ID, user_id: USER_A, name: 'Alice', phone: null, stripe_payment_method_id: 'pm_a', stripe_customer_id: 'cus_a' },
      ],
      messages: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(stripe.paymentMethods.detach).mockResolvedValue({} as any)

    const req = makeRequest({ sessionId: SESSION_ID })
    await leaveSession(req)

    // Session is cancelled
    expect(svcDb._tables.sessions[0].status).toBe('cancelled')

    // No player rows remain for this session
    const remainingPlayers = svcDb._tables.players.filter(
      (p: Record<string, unknown>) => p.session_id === SESSION_ID,
    )
    expect(remainingPlayers.length).toBe(0)
  })

  it('cannot leave a confirmed session — session data is protected', async () => {
    const svcDb = createMockDb({
      sessions: [{
        id: SESSION_ID,
        status: 'confirmed',
        organiser_id: null,
        organiser_name: null,
        organiser_phone: null,
        game_type: 'private',
      }],
      players: [
        { id: 'p-1', session_id: SESSION_ID, user_id: USER_A, name: 'Alice', phone: null, stripe_payment_method_id: 'pm_a', stripe_customer_id: 'cus_a' },
      ],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const req = makeRequest({ sessionId: SESSION_ID })
    const res = await leaveSession(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Cannot leave a confirmed session')

    // Player row must NOT have been removed
    expect(svcDb._tables.players.length).toBe(1)
  })
})
