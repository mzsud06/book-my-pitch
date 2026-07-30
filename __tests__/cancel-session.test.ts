// /api/cancel-session had no dedicated test coverage despite sharing the
// sessions/players tables with /api/leave (leave-cancel.test.ts only covers
// the leave route). Sanity-passing the organiser-initiated cancel path here.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { POST as cancelSession } from '@/app/api/cancel-session/route'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const ORGANISER_ID = 'organiser-aaa'
const OTHER_USER_ID = 'other-user-bbb'

function makeRequest(body: object, userId: string | null = ORGANISER_ID) {
  const authDb = createMockDb({}, userId ? { id: userId } : null)
  vi.mocked(createClient).mockResolvedValue(authDb as any)

  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('cancel-session: only the organiser can cancel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cancels a private session for its organiser', async () => {
    const svcDb = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID, game_type: 'private', is_public: false }],
      players: [{ id: 'p-1', session_id: SESSION_ID, user_id: OTHER_USER_ID }],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await cancelSession(makeRequest({ sessionId: SESSION_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(svcDb._tables.sessions[0].status).toBe('cancelled')

    const notified = svcDb._tables.notifications.find((n: any) => n.user_id === OTHER_USER_ID)
    expect(notified).toBeTruthy()
  })

  it('rejects cancelling a public (open) session — organiser must leave instead', async () => {
    const svcDb = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID, game_type: 'open', is_public: true }],
      players: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await cancelSession(makeRequest({ sessionId: SESSION_ID }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Public games cannot be cancelled — leave the game instead')
    expect(svcDb._tables.sessions[0].status).toBe('filling')
  })

  it('rejects a non-organiser trying to cancel', async () => {
    const svcDb = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID, game_type: 'private', is_public: false }],
      players: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await cancelSession(makeRequest({ sessionId: SESSION_ID }, OTHER_USER_ID))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Only the organiser can cancel this session')
    expect(svcDb._tables.sessions[0].status).toBe('filling')
  })

  it('rejects cancelling an already-confirmed session', async () => {
    const svcDb = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'confirmed', organiser_id: ORGANISER_ID, game_type: 'private', is_public: false }],
      players: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await cancelSession(makeRequest({ sessionId: SESSION_ID }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Confirmed sessions cannot be cancelled')
    expect(svcDb._tables.sessions[0].status).toBe('confirmed')
  })

  it('rejects an unauthenticated request', async () => {
    const svcDb = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID, game_type: 'private', is_public: false }],
      players: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await cancelSession(makeRequest({ sessionId: SESSION_ID }, null))
    expect(res.status).toBe(401)
  })

  it('rejects an already-cancelled or expired session (not in filling state)', async () => {
    const svcDb = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'expired', organiser_id: ORGANISER_ID, game_type: 'private', is_public: false }],
      players: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await cancelSession(makeRequest({ sessionId: SESSION_ID }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Session is not in a cancellable state')
  })
})
