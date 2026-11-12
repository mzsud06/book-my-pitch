import { describe, it, expect, vi, beforeEach } from 'vitest'

const retrieve = vi.fn()
const capture = vi.fn()
const cancel = vi.fn()
const refundCreate = vi.fn()

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: (...a: unknown[]) => retrieve(...a),
      capture: (...a: unknown[]) => capture(...a),
      cancel: (...a: unknown[]) => cancel(...a),
    },
    refunds: { create: (...a: unknown[]) => refundCreate(...a) },
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { confirmGame } from '@/lib/gameLifecycle'
import type { GameRow } from '@/lib/games'

const game = { id: 'g1', organiser_id: 'org1', status: 'full' } as GameRow

// Minimal chainable fake: every method returns the chain, awaiting resolves to
// the canned result for that table, and we record writes.
function fakeSvc(players: { id: string; user_id: string | null; name: string; payment_intent_id: string | null }[]) {
  const writes: { table: string; op: string; payload?: unknown }[] = []
  const svc = {
    from(table: string) {
      let op = 'select'
      const chain: Record<string, unknown> = {}
      const done = () => {
        if (table === 'players' && op === 'select') return { data: players, error: null }
        return { data: [{ id: 'x' }], error: null }
      }
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
        chain[m] = (..._a: unknown[]) => chain
      }
      chain.update = (payload: unknown) => { op = 'update'; writes.push({ table, op, payload }); return chain }
      chain.delete = () => { op = 'delete'; writes.push({ table, op }); return chain }
      chain.insert = (payload: unknown) => { op = 'insert'; writes.push({ table, op, payload }); return chain }
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(done()).then(resolve)
      return chain
    },
  }
  return { svc: svc as never, writes }
}

const players = [
  { id: 'p1', user_id: 'u1', name: 'A', payment_intent_id: 'pi_1' },
  { id: 'p2', user_id: null, name: 'B', payment_intent_id: 'pi_2' },
]

beforeEach(() => {
  vi.clearAllMocks()
  cancel.mockResolvedValue({})
  refundCreate.mockResolvedValue({})
})

describe('confirmGame', () => {
  it('captures every hold and marks the game confirmed', async () => {
    retrieve.mockResolvedValue({ status: 'requires_capture' })
    capture.mockResolvedValue({})
    const { svc, writes } = fakeSvc(players)

    const r = await confirmGame(svc, game)

    expect(r).toEqual({ ok: true })
    expect(capture).toHaveBeenCalledTimes(2)
    expect(writes.some(w => w.table === 'sessions' && (w.payload as { status?: string })?.status === 'confirmed')).toBe(true)
  })

  it('charges nobody and reopens the game if a hold has lapsed', async () => {
    retrieve.mockImplementation(async (id: string) => ({ status: id === 'pi_2' ? 'canceled' : 'requires_capture' }))
    const { svc, writes } = fakeSvc(players)

    const r = await confirmGame(svc, game)

    expect(r.ok).toBe(false)
    expect(capture).not.toHaveBeenCalled()
    expect(writes.some(w => w.table === 'players' && w.op === 'delete')).toBe(true)
    expect(writes.some(w => w.table === 'sessions' && (w.payload as { status?: string })?.status === 'filling')).toBe(true)
  })

  it('refunds captured payments and reopens if a capture fails', async () => {
    retrieve.mockResolvedValue({ status: 'requires_capture' })
    capture.mockImplementation(async (id: string) => { if (id === 'pi_2') throw new Error('declined') })
    const { svc } = fakeSvc(players)

    const r = await confirmGame(svc, game)

    expect(r.ok).toBe(false)
    expect(refundCreate).toHaveBeenCalledTimes(1)
    expect(refundCreate).toHaveBeenCalledWith({ payment_intent: 'pi_1' })
  })
})
