import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdminEmail } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logSecurityEvent } from '@/lib/securityLog'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email)) {
    logSecurityEvent('admin_auth_failed', {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      ip: getClientIp(req),
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!checkRateLimit(`admin-approve-venue:${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { venueId, approved } = await req.json()

    if (!isValidUUID(venueId)) {
      return NextResponse.json({ error: 'Invalid venue' }, { status: 400 })
    }
    if (typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Invalid approved value' }, { status: 400 })
    }

    const svc = createServiceClient()
    const { error } = await svc
      .from('venues')
      .update({ admin_approved: approved })
      .eq('id', venueId)

    if (error) {
      console.error('approve-venue: update failed:', error.message)
      return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('approve-venue error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
