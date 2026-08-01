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

// No logged-in session by default (the common case: a fresh signup) — pass
// a signUp mock. `identities: [{}]` marks a genuinely new account; Supabase's
// anti-enumeration protection signals "email already has an account" (with
// no authError) via an empty identities array instead.
function mockAnonClient(signUpResult: { data: any; error: any }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signUp: vi.fn().mockResolvedValue(signUpResult),
    },
  } as any)
}

// Visitor already has an active session (player or previous owner signup).
function mockLoggedInClient(user: { id: string; email: string }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      signUp: vi.fn(),
    },
  } as any)
}

const VALID_SIGNUP_BODY = {
  email: 'owner@example.com',
  password: 'password123',
  venueName: 'Test Pitch',
  address: '1 Test Street, London',
  contactPhone: '07123 456789',
  openingTime: '15:30',
  closingTime: '21:30',
  weekendOpeningTime: '09:30',
  weekendClosingTime: '21:30',
  peakStartTime: '18:30',
  pitches: [
    { format: '5-a-side', surface: '4G', peakPrice: 50, offpeakPrice: 30, weekendPrice: 40 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockReturnValue(true)
  // Default: no logged-in session — most tests only exercise input
  // validation before auth is ever touched. Tests that need specific signUp
  // behavior override this with mockAnonClient/mockLoggedInClient.
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }), signUp: vi.fn() },
  } as any)
})

describe('POST /api/owner/signup', () => {
  it('creates the auth user, venue, and pitch, and seeds slots on a valid request', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

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
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: null },
      error: null,
    })

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sessionCreated).toBe(false)
    // Venue/pitch are created regardless of email-confirmation state.
    expect(svcDb._tables.venues.length).toBe(1)
  })

  it('rejects an invalid email without touching auth or the database', async () => {
    const signUp = vi.fn()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }), signUp },
    } as any)

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

  it('rejects a weekday closing time before opening time', async () => {
    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, closingTime: '10:00', openingTime: '15:30' }))
    expect(res.status).toBe(400)
  })

  it('rejects a malformed time string', async () => {
    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, peakStartTime: 'not-a-time' }))
    expect(res.status).toBe(400)
  })

  it('rejects a peak start time that can never trigger (after both closing times)', async () => {
    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, peakStartTime: '22:00' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/before your venue closes/)
  })

  it('rejects a missing contact phone number', async () => {
    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, contactPhone: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects an invalid amenity', async () => {
    const res = await ownerSignup(makeRequest({ ...VALID_SIGNUP_BODY, amenities: ['floodlights', 'jacuzzi'] }))
    expect(res.status).toBe(400)
  })

  it('rejects daily hours where closing is before opening', async () => {
    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      dailyHours: { monday: { opening: '10:00', closing: '08:00' } },
    }))
    expect(res.status).toBe(400)
  })

  it('stores contact phone, amenities, booking notice, daily hours, and custom pitch name', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      amenities: ['floodlights', 'parking'],
      minBookingNoticeMinutes: 30,
      dailyHours: { monday: { opening: '09:00', closing: '22:00' } },
      pitches: [{ ...VALID_SIGNUP_BODY.pitches[0], name: 'The Cage' }],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(svcDb._tables.venues[0].contact_phone).toBe('07123 456789')
    expect(svcDb._tables.venues[0].amenities).toEqual(['floodlights', 'parking'])
    expect(svcDb._tables.venues[0].min_booking_notice_minutes).toBe(30)
    expect(svcDb._tables.venues[0].daily_hours).toEqual({ monday: { opening: '09:00', closing: '22:00' } })
    expect(svcDb._tables.pitches[0].name).toBe('The Cage')
  })

  it('uploads a venue photo and stores its public URL when one is submitted', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    const upload = vi.fn().mockResolvedValue({ error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/venue-photos/abc.jpg' } })
    ;(svcDb as any).storage = { from: () => ({ upload, getPublicUrl }) }
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      photoDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==',
    }))

    expect(res.status).toBe(200)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(svcDb._tables.venues[0].photo_url).toBe('https://cdn.example/venue-photos/abc.jpg')
  })

  it('does not touch storage when no photo is submitted', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    const upload = vi.fn()
    ;(svcDb as any).storage = { from: () => ({ upload, getPublicUrl: vi.fn() }) }
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    expect(res.status).toBe(200)
    expect(upload).not.toHaveBeenCalled()
  })

  it('succeeds even when the photo upload fails (best-effort, non-fatal)', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    const upload = vi.fn().mockResolvedValue({ error: { message: 'storage down' } })
    ;(svcDb as any).storage = { from: () => ({ upload, getPublicUrl: vi.fn() }) }
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      photoDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(svcDb._tables.venues[0].photo_url).toBeUndefined()
  })

  it('stores the submitted schedule on the venue row', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

    const res = await ownerSignup(makeRequest({
      ...VALID_SIGNUP_BODY,
      openingTime: '09:00',
      closingTime: '23:00',
      weekendOpeningTime: '08:00',
      weekendClosingTime: '23:00',
      peakStartTime: '17:00',
    }))

    expect(res.status).toBe(200)
    expect(svcDb._tables.venues[0].opening_time).toBe('09:00')
    expect(svcDb._tables.venues[0].peak_start_time).toBe('17:00')
  })

  it('creates multiple pitches for one venue and seeds slots once for all of them', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

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
    mockAnonClient({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    })

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('User already registered')
    expect(svcDb._tables.venues.length).toBe(0)
  })

  it('rejects with a clear message when anti-enumeration protection silently no-ops signUp for an existing email', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    // No authError — Supabase's enumeration protection returns a "success"
    // with an empty identities array instead of revealing the email exists.
    mockAnonClient({
      data: { user: { id: 'someone-elses-id', identities: [] }, session: null },
      error: null,
    })

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/already exists/i)
    // Must never attach a venue to the existing account behind that email.
    expect(svcDb._tables.venues.length).toBe(0)
  })

  it('rolls back the auth user if venue creation fails', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    svcDb._forceInsertError({ message: 'db down' })
    const deleteUser = vi.fn().mockResolvedValue({})
    ;(svcDb as any).auth.admin = { deleteUser }
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockAnonClient({
      data: { user: { id: 'new-owner-id', identities: [{ id: 'x' }] }, session: { access_token: 'tok' } },
      error: null,
    })

    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    expect(res.status).toBe(500)
    expect(deleteUser).toHaveBeenCalledWith('new-owner-id')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false)
    const res = await ownerSignup(makeRequest(VALID_SIGNUP_BODY))
    expect(res.status).toBe(429)
  })

  it('attaches the venue to an already-logged-in user instead of creating a new account', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockLoggedInClient({ id: 'existing-player-id', email: 'player@example.com' })

    const { email, password, ...bodyWithoutCreds } = VALID_SIGNUP_BODY
    const res = await ownerSignup(makeRequest(bodyWithoutCreds))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(svcDb._tables.venues[0].owner_id).toBe('existing-player-id')
  })

  it('never deletes an existing user on rollback, only a freshly created one', async () => {
    const svcDb = createMockDb({ venues: [], pitches: [] })
    svcDb._forceInsertError({ message: 'db down' })
    const deleteUser = vi.fn().mockResolvedValue({})
    ;(svcDb as any).auth.admin = { deleteUser }
    vi.mocked(createServiceClient).mockReturnValue(svcDb as any)
    mockLoggedInClient({ id: 'existing-player-id', email: 'player@example.com' })

    const { email, password, ...bodyWithoutCreds } = VALID_SIGNUP_BODY
    const res = await ownerSignup(makeRequest(bodyWithoutCreds))
    expect(res.status).toBe(500)
    expect(deleteUser).not.toHaveBeenCalled()
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
