// Tests for the new self-serve owner onboarding routes:
// POST /api/owner/signup (creates auth user + venue + pitch + seeds slots)
// POST /api/owner/stripe-onboarding-link (creates/reuses Connect account + link)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { createMockDb } from './helpers/mockDb'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/seedSlots', () => ({ seedSlotsForVenue: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn().mockReturnValue(true), getClientIp: vi.fn().mockReturnValue('test-ip') }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: { create: vi.fn() },
    accountLinks: { create: vi.fn() },
  },
}))

import { POST as ownerSignup } from '@/app/api/owner/signup/route'
import { POST as stripeOnboardingLink } from '@/app/api/owner/stripe-onboarding-link/route'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { seedSlotsForVenue } from '@/lib/seedSlots'
import { checkRateLimit } from '@/lib/rateLimit'
import { stripe } from '@/lib/stripe'

function makeRequest(body: object) {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const VALID_SIGNUP_BODY = {
  email: 'owner@example.com',
  password: 'password123',
  venueName: 'Test Pitch',
  address: '1 Test Street, London',
  pitches: [
    { format: '5-a-side', surface: '4G', peakPrice: 50, offpeakPrice: 30, weekendPrice: 40 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockReturnValue(true)
})

describe('POST /api/owner/signup', () => {
  it('creates the auth user, venue, and pitch, and seeds slots on a valid request', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-owner-id' }, session: { access_token: 'tok' } },
          error: null,
        }),
      },
    } as any)

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.sessionCreated).toBe(true)
    expect(typeof body.venueId).toBe('string')

    expect(svcDb._tables.venues.length).toBe(1)
    expect(svcDb._tables.venues[0].owner_id).toBe('new-owner-id')
    expect(svcDb._tables.venues[0].name).toBe('Test Pitch')

    expect(svcDb._tables.pitches.length).toBe(1)
    expect(svcDb._tables.pitches[0].max_players).toBe(10) // 5-a-side, server-derived
    expect(svcDb._tables.pitches[0].peak_price).toBe(50)

    expect(vi.mocked(seedSlotsForVenue)).toHaveBeenCalledTimes(1)
  })

  it('reports sessionCreated: false when email confirmation is required (no session returned)', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-owner-id' }, session: null },
          error: null,
        }),
      },
    } as any)

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sessionCreated).toBe(false)
    // Venue/pitch are created regardless of email-confirmation state.
    expect(svcDb._tables.venues.length).toBe(1)
  })

  it('rejects an invalid email without touching auth or the database', async () => {
    const signUp = vi.fn()
    vi.mocked(createClient).mockResolvedValue({ auth: { signUp } } as any)

    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(signUp).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('rejects an invalid pitch format', async () => {
    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      pitches: [{ ...VALID_SIGNUP_BODY.pitches[0], format: '9-a-side' }],
    }))
    expect(res.status).toBe(400)
  })

  it('rejects an out-of-range price', async () => {
    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      pitches: [{ ...VALID_SIGNUP_BODY.pitches[0], peakPrice: 501 }],
    }))
    expect(res.status).toBe(400)
  })

  it('rejects an empty pitches array', async () => {
    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, pitches: [] }))
    expect(res.status).toBe(400)
  })

  it('creates multiple pitches for one venue and seeds slots once for all of them', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-owner-id' }, session: { access_token: 'tok' } },
          error: null,
        }),
      },
    } as any)

    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      pitches: [
        { format: '5-a-side', surface: '4G', peakPrice: 50, offpeakPrice: 30, weekendPrice: 40 },
        { format: '7-a-side', surface: '3G', peakPrice: 70, offpeakPrice: 42, weekendPrice: 56 },
      ],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(svcDb._tables.pitches.length).toBe(2)
    expect(svcDb._tables.pitches[0].name).toBe('Pitch 1')
    expect(svcDb._tables.pitches[1].name).toBe('Pitch 2')
    expect(svcDb._tables.pitches[1].max_players).toBe(14) // 7-a-side
    expect(vi.mocked(seedSlotsForVenue)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(seedSlotsForVenue).mock.calls[0][2]).toHaveLength(2)
  })

  it('returns the auth error message and creates nothing when signUp fails', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'User already registered' },
        }),
      },
    } as any)

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('User already registered')
    expect(svcDb._tables.venues.length).toBe(0)
  })

  it('rolls back the auth user if venue creation fails', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    svcDb._forceInsertError({ message: 'db down' })
    const deleteUser = vi.fn().mockResolvedValue({})
    ;(svcDb as any).auth.admin = { deleteUser }
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-owner-id' }, session: { access_token: 'tok' } },
          error: null,
        }),
      },
    } as any)

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    expect(res.status).toBe(500)
    expect(deleteUser).toHaveBeenCalledWith('new-owner-id')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false)
    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    expect(res.status).toBe(429)
  })
})

describe('POST /api/owner/stripe-onboarding-link', () => {
  const OWNER_ID = 'owner-1'
  const VENUE_ID = '44444444-4444-4444-4444-444444444444'

  function makeAuthedRequest(body: object, userId: string | null = OWNER_ID) {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId, email: 'owner@example.com' } : null } }) },
    } as any)
    return makeRequest(body)
  }

  it('creates a Connect account when the venue has none yet, saves it, and returns an onboarding link', async () => {
    const svcDb = createMockDb({
      venues: [{ id: VENUE_ID, name: 'Test Pitch', owner_id: OWNER_ID, stripe_account_id: null }],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(stripe.accounts.create).mockResolvedValue({ id: 'acct_new123' } as any)
    vi.mocked(stripe.accountLinks.create).mockResolvedValue({ url: 'https://connect.stripe.com/setup/xyz' } as any)

    const res = await stripeOnboardingLink(makeAuthedRequest({ venueId: VENUE_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe('https://connect.stripe.com/setup/xyz')
    expect(svcDb._tables.venues[0].stripe_account_id).toBe('acct_new123')
    expect(vi.mocked(stripe.accountLinks.create)).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_new123', type: 'account_onboarding' }),
    )
  })

  it('reuses an existing Connect account instead of creating a new one', async () => {
    const svcDb = createMockDb({
      venues: [{ id: VENUE_ID, name: 'Test Pitch', owner_id: OWNER_ID, stripe_account_id: 'acct_existing' }],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    vi.mocked(stripe.accountLinks.create).mockResolvedValue({ url: 'https://connect.stripe.com/setup/resume' } as any)

    const res = await stripeOnboardingLink(makeAuthedRequest({ venueId: VENUE_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe('https://connect.stripe.com/setup/resume')
    expect(vi.mocked(stripe.accounts.create)).not.toHaveBeenCalled()
    expect(vi.mocked(stripe.accountLinks.create)).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_existing' }),
    )
  })

  it('rejects an unauthenticated request', async () => {
    const res = await stripeOnboardingLink(makeAuthedRequest({ venueId: VENUE_ID }, null))
    expect(res.status).toBe(401)
  })

  it('rejects a caller who does not own the venue', async () => {
    const svcDb = createMockDb({
      venues: [{ id: VENUE_ID, name: 'Test Pitch', owner_id: 'someone-else', stripe_account_id: null }],
    })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await stripeOnboardingLink(makeAuthedRequest({ venueId: VENUE_ID }))
    expect(res.status).toBe(403)
    expect(vi.mocked(stripe.accounts.create)).not.toHaveBeenCalled()
  })

  it('returns 404 for a venue that does not exist', async () => {
    const svcDb = createMockDb({ venues: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)

    const res = await stripeOnboardingLink(makeAuthedRequest({ venueId: VENUE_ID }))
    expect(res.status).toBe(404)
  })
})
