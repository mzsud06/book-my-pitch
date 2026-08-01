import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { triggerPayments, SlotForPayment } from '@/lib/triggerPayments'
import { getClientIp } from '@/lib/rateLimit'
import { logSecurityEvent } from '@/lib/securityLog'

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch — compare lengths first (not
  // secret-dependent timing, since length alone isn't sensitive here).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export async function POST(req: NextRequest) {
  // Explicitly require INTERNAL_SECRET to be configured and non-empty.
  // An unset or empty secret must never grant access.
  const internalSecret = process.env.INTERNAL_SECRET
  if (!internalSecret) {
    logSecurityEvent('internal_secret_not_configured', { ip: getClientIp(req) })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providedSecret = req.headers.get('x-internal-secret')
  if (!providedSecret || !secretsMatch(providedSecret, internalSecret)) {
    logSecurityEvent('internal_secret_mismatch', { ip: getClientIp(req), hadSecret: !!providedSecret })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let sessionId: string | undefined
  try {
    const body = await req.json()
    sessionId = body.sessionId

    if (!isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }

    // Service-role client bypasses RLS so we can read all players' payment data,
    // update session status, and insert the booking row from a server-side context.
    const supabase = createServiceClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('*, slots(*, pitches(*))')
      .eq('id', sessionId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.status === 'confirmed') return NextResponse.json({ message: 'Already confirmed' })
    if (session.status === 'cancelled' || session.status === 'expired') {
      return NextResponse.json({ message: `Session is ${session.status}, nothing to charge` })
    }

    const slot = session.slots
    const sessionSlotIds: string[] = (session.slot_ids && session.slot_ids.length > 0) ? session.slot_ids : [slot.id]

    const expectedTotal = slot.pitches.max_players

    const { count: payingCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .not('stripe_payment_method_id', 'is', null)
      .not('stripe_customer_id', 'is', null)

    if ((payingCount ?? 0) < expectedTotal) {
      return NextResponse.json({ error: 'Not enough players' }, { status: 400 })
    }

    const result = await triggerPayments(sessionId, slot as unknown as SlotForPayment, sessionSlotIds)

    if (result.ok) {
      return NextResponse.json({ success: true, message: 'All payments succeeded, session confirmed' })
    }

    return NextResponse.json({
      success: false,
      message: 'Some payments failed. No successful charges were captured, so no one was charged, and affected players were removed so they can rejoin with a working card.',
    }, { status: 422 })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'POST /api/trigger-payments' },
      extra: { session_id: sessionId ?? null },
    })
    console.error('trigger-payments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
