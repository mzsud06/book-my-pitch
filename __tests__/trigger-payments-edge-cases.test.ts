// Edge cases flagged as untested after the triggerPayments two-phase-charge
// refactor: multiple simultaneous auth failures, rival-session cancellation,
// multi-hour (120/180 min) price math, and capture-failure-after-authorize.
// Each of these is exercised directly against triggerPayments() rather than
// the /api/trigger-payments route so slotIds and rival session state can be
// controlled precisely.

import { describe, it, expect, vi, beforeEach } from 'vitest'
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
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { triggerPayments, SlotForPayment } from '@/lib/triggerPayments'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'

const SESSION_ID = '11111111-1111-1111-1111-111111111111'
const SLOT_ID = '22222222-2222-2222-2222-222222222222'
const VENUE_ID = '33333333-3333-3333-3333-333333333333'
const ORGANISER_ID = 'organiser-1'

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const pitch = { id: 'pitch-1', name: 'Main Pitch', format: '5-a-side', surface: '4G', max_players: 10, peak_price: 50, offpeak_price: 30, weekend_price: 40 }

const mockSlotData = {
  id: SLOT_ID,
  price: 30,
  venue_id: VENUE_ID,
  pitches: pitch,
  start_time: '19:00',
  end_time: '20:00',
  date: FUTURE_DATE,
}

function makePlayer(i: number, userId: string | null = `user-${i}`) {
  return {
    id: `player-${i}`,
    name: `Player ${i}`,
    session_id: SESSION_ID,
    user_id: userId,
    stripe_customer_id: `cus_${i}`,
    stripe_payment_method_id: `pm_${i}`,
    phone: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Multiple simultaneous auth failures ─────────────────────────────────────

describe('triggerPayments: multiple simultaneous authorization failures', () => {
  it('removes all failed players, cancels all successful holds, and lists every failed name to the organiser', async () => {
    // Player 1 is the organiser and succeeds. Players 3, 6, 9 fail — three
    // simultaneous declines, never exercised before (only 1-bad-card was
    // tested live). The rest (2,4,5,7,8,10) succeed.
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID }],
      venues: [{ id: VENUE_ID, name: 'Globe Pitch', stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players,
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)

    const FAILED_IDS = new Set(['player-3', 'player-6', 'player-9'])
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) => {
      if (FAILED_IDS.has(params.metadata.player_id)) throw new Error('Card declined')
      return { id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any
    })
    vi.mocked(stripe.paymentIntents.cancel).mockResolvedValue({ status: 'canceled' } as any)

    const result = await triggerPayments(SESSION_ID, mockSlotData as unknown as SlotForPayment, [SLOT_ID])

    expect(result.ok).toBe(false)
    expect(new Set(result.failedPlayerIds)).toEqual(FAILED_IDS)

    // 7 successful holds must all be cancelled (free), never captured.
    expect(vi.mocked(stripe.paymentIntents.cancel)).toHaveBeenCalledTimes(7)
    expect(vi.mocked(stripe.paymentIntents.capture)).not.toHaveBeenCalled()

    // The 3 failed players are removed; the 7 successful ones remain.
    expect(db._tables.players.length).toBe(7)
    for (const id of FAILED_IDS) {
      expect(db._tables.players.some((p: any) => p.id === id)).toBe(false)
    }

    // Each failed player (all have accounts) gets the freed-spot notification.
    const freedSpotNotifications = db._tables.notifications.filter(
      (n: any) => n.message.includes('your spot has been freed up'),
    )
    expect(freedSpotNotifications.length).toBe(3)

    // Organiser gets one notification naming all 3 failed players, joined
    // with "and" for the last — formatNameList had never been exercised
    // with more than one name before this.
    const organiserNotifications = db._tables.notifications.filter(
      (n: any) => n.user_id === ORGANISER_ID,
    )
    expect(organiserNotifications.length).toBe(1)
    expect(organiserNotifications[0].message).toContain('Player 3, Player 6 and Player 9')
  })
})

// ── Rival-session cancellation ──────────────────────────────────────────────

describe('triggerPayments: rival session cancellation on confirm', () => {
  it('cancels a rival session competing for the same slot_id and notifies its players', async () => {
    const RIVAL_SESSION_ID = 'rival-session-1'
    const RIVAL_USER_ID = 'rival-user-1'
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [
        { id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID },
        { id: RIVAL_SESSION_ID, status: 'filling', slot_id: SLOT_ID, slot_ids: [SLOT_ID], organiser_id: null },
      ],
      venues: [{ id: VENUE_ID, name: 'Globe Pitch', stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players: [...players, { id: 'rival-player-1', session_id: RIVAL_SESSION_ID, user_id: RIVAL_USER_ID, name: 'Rival', stripe_customer_id: null, stripe_payment_method_id: null, phone: null }],
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) =>
      ({ id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any))
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({ status: 'succeeded' } as any)

    const result = await triggerPayments(SESSION_ID, mockSlotData as unknown as SlotForPayment, [SLOT_ID])

    expect(result.ok).toBe(true)
    const rival = db._tables.sessions.find((s: any) => s.id === RIVAL_SESSION_ID)
    expect(rival?.status).toBe('cancelled')

    const rivalNotification = db._tables.notifications.find(
      (n: any) => n.user_id === RIVAL_USER_ID,
    )
    expect(rivalNotification).toBeTruthy()
    expect(rivalNotification!.message).toContain('cancelled')
  })

  it('cancels a rival multi-hour session whose slot_ids array overlaps the confirmed slots', async () => {
    const RIVAL_SESSION_ID = 'rival-session-2'
    const RIVAL_USER_ID = 'rival-user-2'
    const OTHER_SLOT_ID = 'other-slot-id'
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [
        { id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID },
        // Rival's primary slot_id is different, but its multi-hour slot_ids
        // array overlaps one of the slots this session just confirmed.
        { id: RIVAL_SESSION_ID, status: 'filling', slot_id: OTHER_SLOT_ID, slot_ids: [OTHER_SLOT_ID, SLOT_ID], organiser_id: null },
      ],
      venues: [{ id: VENUE_ID, name: 'Globe Pitch', stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players: [...players, { id: 'rival-player-2', session_id: RIVAL_SESSION_ID, user_id: RIVAL_USER_ID, name: 'Rival', stripe_customer_id: null, stripe_payment_method_id: null, phone: null }],
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) =>
      ({ id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any))
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({ status: 'succeeded' } as any)

    const result = await triggerPayments(SESSION_ID, mockSlotData as unknown as SlotForPayment, [SLOT_ID])

    expect(result.ok).toBe(true)
    const rival = db._tables.sessions.find((s: any) => s.id === RIVAL_SESSION_ID)
    expect(rival?.status).toBe('cancelled')
  })
})

// ── Multi-hour booking price math ───────────────────────────────────────────

describe('triggerPayments: multi-hour booking combines price across slots', () => {
  it('charges the combined 3-slot total per player and creates one booking row per slot', async () => {
    const SLOT_1 = 'slot-hour-1'
    const SLOT_2 = 'slot-hour-2'
    const SLOT_3 = 'slot-hour-3'
    const slotRows = [
      { id: SLOT_1, price: 50, venue_id: VENUE_ID, pitches: pitch, date: FUTURE_DATE, start_time: '18:30', end_time: '19:30' },
      { id: SLOT_2, price: 50, venue_id: VENUE_ID, pitches: pitch, date: FUTURE_DATE, start_time: '19:30', end_time: '20:30' },
      { id: SLOT_3, price: 50, venue_id: VENUE_ID, pitches: pitch, date: FUTURE_DATE, start_time: '20:30', end_time: '21:30' },
    ]
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID }],
      venues: [{ id: VENUE_ID, name: 'Globe Pitch', stripe_account_id: 'acct_test' }],
      slots: slotRows,
      players,
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) =>
      ({ id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any))
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({ status: 'succeeded' } as any)

    const slotForPayment = { id: SLOT_1, price: 50, venue_id: VENUE_ID, pitches: pitch }
    const result = await triggerPayments(SESSION_ID, slotForPayment as unknown as SlotForPayment, [SLOT_1, SLOT_2, SLOT_3])

    expect(result.ok).toBe(true)

    // Combined price = 50+50+50 = 150 → per-player pitch share = 150*100/10 = 1500p
    // + 50p platform fee + 30p processing = 1580p total per player.
    const createCalls = vi.mocked(stripe.paymentIntents.create).mock.calls
    expect(createCalls.length).toBe(10)
    for (const [params] of createCalls) {
      expect((params as any).amount).toBe(1580)
    }

    // One booking row per locked slot.
    expect(db._tables.bookings.length).toBe(3)
    expect(new Set(db._tables.bookings.map((b: any) => b.slot_id))).toEqual(new Set([SLOT_1, SLOT_2, SLOT_3]))
  })
})

// ── Capture failure after successful authorization ──────────────────────────

describe('triggerPayments: capture fails after authorization succeeded', () => {
  it('refunds only the players whose capture actually succeeded, removes the capture-failed players, and leaves the session unconfirmed', async () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID }],
      venues: [{ id: VENUE_ID, name: 'Globe Pitch', stripe_account_id: 'acct_test' }],
      slots: [mockSlotData],
      players,
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)

    // Every card authorizes fine.
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) =>
      ({ id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any))

    // Capture fails for players 1 and 2 moments later (e.g. card revoked
    // mid-flight) — the rare edge case with no reliable Stripe test card.
    const CAPTURE_FAIL_IDS = new Set(['pi_player-1', 'pi_player-2'])
    vi.mocked(stripe.paymentIntents.capture).mockImplementation(async (id: string) => {
      if (CAPTURE_FAIL_IDS.has(id)) throw new Error('Capture failed — card revoked')
      return { status: 'succeeded' } as any
    })
    vi.mocked(stripe.refunds.create).mockResolvedValue({ status: 'succeeded' } as any)

    const result = await triggerPayments(SESSION_ID, mockSlotData as unknown as SlotForPayment, [SLOT_ID])

    expect(result.ok).toBe(false)
    expect(new Set(result.failedPlayerIds)).toEqual(new Set(['player-1', 'player-2']))

    // The 8 that captured successfully were genuinely charged — refund them.
    expect(vi.mocked(stripe.refunds.create)).toHaveBeenCalledTimes(8)
    const refundedIds = vi.mocked(stripe.refunds.create).mock.calls.map(([arg]: any) => arg.payment_intent)
    expect(new Set(refundedIds)).toEqual(
      new Set(['player-3', 'player-4', 'player-5', 'player-6', 'player-7', 'player-8', 'player-9', 'player-10'].map(id => `pi_${id}`)),
    )

    // The 2 that never captured are removed and notified, no refund needed for them.
    expect(db._tables.players.length).toBe(8)
    expect(db._tables.players.some((p: any) => p.id === 'player-1' || p.id === 'player-2')).toBe(false)
    const freedSpotNotifications = db._tables.notifications.filter(
      (n: any) => n.message.includes('your spot has been freed up'),
    )
    expect(freedSpotNotifications.length).toBe(2)

    // Session never got flipped to confirmed, and no booking was created.
    const session = db._tables.sessions.find((s: any) => s.id === SESSION_ID)
    expect(session?.status).toBe('filling')
    expect(db._tables.bookings.length).toBe(0)
  })
})

// ── Unverified Connect account safety gate ──────────────────────────────────

describe('triggerPayments: refuses to transfer to an unverified Connect account', () => {
  it('falls back to platform-direct charging when stripe_account_id exists but onboarding is not complete', async () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID }],
      // Onboarding started (account exists) but Stripe hasn't verified it yet.
      venues: [{ id: VENUE_ID, name: 'Globe Pitch', stripe_account_id: 'acct_unverified', stripe_onboarding_complete: false }],
      slots: [mockSlotData],
      players,
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) =>
      ({ id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any))
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({ status: 'succeeded' } as any)

    const result = await triggerPayments(SESSION_ID, mockSlotData as unknown as SlotForPayment, [SLOT_ID])

    expect(result.ok).toBe(true)
    const createCalls = vi.mocked(stripe.paymentIntents.create).mock.calls
    for (const [params] of createCalls) {
      expect((params as any).application_fee_amount).toBeUndefined()
      expect((params as any).transfer_data).toBeUndefined()
    }
  })

  it('uses transfer_data and application_fee_amount once onboarding is complete AND admin-approved', async () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID }],
      venues: [{ id: VENUE_ID, name: 'Globe Pitch', stripe_account_id: 'acct_verified', stripe_onboarding_complete: true, admin_approved: true }],
      slots: [mockSlotData],
      players,
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) =>
      ({ id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any))
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({ status: 'succeeded' } as any)

    const result = await triggerPayments(SESSION_ID, mockSlotData as unknown as SlotForPayment, [SLOT_ID])

    expect(result.ok).toBe(true)
    const [firstParams] = vi.mocked(stripe.paymentIntents.create).mock.calls[0]
    expect((firstParams as any).transfer_data).toEqual({ destination: 'acct_verified' })
    expect((firstParams as any).application_fee_amount).toBe(50)
  })

  it('falls back to platform-direct charging when onboarding is complete but admin_approved is false', async () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1))
    const db = createMockDb({
      sessions: [{ id: SESSION_ID, status: 'filling', organiser_id: ORGANISER_ID }],
      // Stripe-verified, but nobody has manually vetted this venue yet —
      // /api/sessions should already refuse to create a session here, but
      // this proves triggerPayments itself won't transfer money either.
      venues: [{ id: VENUE_ID, name: 'Sketchy Pitch', stripe_account_id: 'acct_verified', stripe_onboarding_complete: true, admin_approved: false }],
      slots: [mockSlotData],
      players,
      bookings: [],
      notifications: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    vi.mocked(stripe.paymentIntents.create).mockImplementation(async (params: any) =>
      ({ id: `pi_${params.metadata.player_id}`, status: 'requires_capture' } as any))
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({ status: 'succeeded' } as any)

    const result = await triggerPayments(SESSION_ID, mockSlotData as unknown as SlotForPayment, [SLOT_ID])

    expect(result.ok).toBe(true)
    const createCalls = vi.mocked(stripe.paymentIntents.create).mock.calls
    for (const [params] of createCalls) {
      expect((params as any).application_fee_amount).toBeUndefined()
      expect((params as any).transfer_data).toBeUndefined()
    }
  })
})
