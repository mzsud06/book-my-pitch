import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

const PHONE_RE = /^\+[0-9]{7,15}$/

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`send-message:${getClientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { sessionId, content, phone } = body

    if (!isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }
    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    if (!trimmedContent || trimmedContent.length > 1000) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const svc = createServiceClient()

    // Resolve the sender's name from their verified player row rather than
    // trusting any client-supplied name — this is what actually confirms
    // eligibility and prevents chat impersonation.
    let senderName: string

    if (user?.id) {
      const { data: player } = await svc
        .from('players')
        .select('name')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!player) {
        return NextResponse.json({ error: 'You are not in this session' }, { status: 403 })
      }
      senderName = (player as { name: string }).name
    } else {
      const trimmedPhone = typeof phone === 'string' ? phone.trim() : ''
      if (!trimmedPhone || !PHONE_RE.test(trimmedPhone)) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
      }

      const { data: session } = await svc
        .from('sessions')
        .select('id, status')
        .eq('id', sessionId)
        .maybeSingle()
      if (!session || (session as { status: string }).status !== 'confirmed') {
        return NextResponse.json({ error: 'Chat is only available once the game is confirmed' }, { status: 403 })
      }

      const { data: player } = await svc
        .from('players')
        .select('name')
        .eq('session_id', sessionId)
        .eq('phone', trimmedPhone)
        .maybeSingle()
      if (!player) {
        return NextResponse.json({ error: 'You are not in this session' }, { status: 403 })
      }
      senderName = (player as { name: string }).name
    }

    const { error: insertError } = await svc.from('messages').insert({
      session_id: sessionId,
      user_id: user?.id ?? null,
      content: trimmedContent,
      sender_name: senderName,
    })

    if (insertError) {
      console.error('send-message insert error:', insertError.message)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
