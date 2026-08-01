import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

function redactPhone(phone: string | null | undefined): string {
  if (!phone) return '(none)'
  return `${phone.slice(0, 3)}****`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, phone } = body

    if (!isValidUUID(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const trimmedPhone = typeof phone === 'string' ? phone.trim() : null
    if (trimmedPhone && !/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const svc = createServiceClient()

    // Verify session exists and is still filling
    const { data: session } = await svc
      .from('sessions')
      .select('id, status, organiser_name, organiser_phone, organiser_id, game_type')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.status !== 'filling') {
      return NextResponse.json({ error: 'Cannot leave a confirmed session' }, { status: 400 })
    }

    // Locate the player record — by user_id for authenticated users, by phone for guests
    type PlayerRow = {
      id: string
      name: string
      phone: string | null
      user_id: string | null
      stripe_payment_method_id: string | null
      stripe_customer_id: string | null
    }
    let player: PlayerRow | null = null

    if (user?.id) {
      const { data } = await svc
        .from('players')
        .select('id, name, phone, user_id, stripe_payment_method_id, stripe_customer_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
      player = data as PlayerRow | null
    } else if (trimmedPhone) {
      const { data } = await svc
        .from('players')
        .select('id, name, phone, user_id, stripe_payment_method_id, stripe_customer_id')
        .eq('session_id', sessionId)
        .eq('phone', trimmedPhone)
        .maybeSingle()
      player = data as PlayerRow | null

      // A phone was supplied but doesn't match any player in this session —
      // flag it, since this is the shape of an attempt to remove someone else's
      // guest entry by guessing/knowing their number.
      if (!player) {
        console.warn(`[leave] suspicious: phone ${redactPhone(trimmedPhone)} does not match any player in session ${sessionId}`)
      }
    } else {
      return NextResponse.json({ error: 'Cannot identify player' }, { status: 401 })
    }

    if (!player) {
      return NextResponse.json({ error: 'You are not in this session' }, { status: 404 })
    }

    // Defense-in-depth: re-assert identity right before any mutation, even though
    // the lookups above already scope by user_id/phone. Never detach a payment
    // method or delete a row unless the caller is that authenticated user, or
    // supplied the exact phone number stored on the row.
    const identityConfirmed =
      (!!user?.id && player.user_id === user.id) ||
      (!!trimmedPhone && player.phone === trimmedPhone)
    if (!identityConfirmed) {
      console.warn(`[leave] suspicious: identity not confirmed for player ${player.id} in session ${sessionId}`)
      return NextResponse.json({ error: 'Cannot identify player' }, { status: 401 })
    }

    const sesh = session as { organiser_name: string | null; organiser_phone: string | null; organiser_id: string | null; game_type: string | null }
    const isOrganiserById = !!(user?.id && sesh.organiser_id && user.id === sesh.organiser_id)
    const isOrganiserByPhone = !!(sesh.organiser_phone && player.phone && player.phone === sesh.organiser_phone)
    const isOrganiserByName = !!(sesh.organiser_name && player.name?.toLowerCase() === sesh.organiser_name.toLowerCase())
    const leavingAsOrganiser = isOrganiserById || isOrganiserByPhone || isOrganiserByName
    // Organiser may leave private and open sessions — the game continues without them.
    const organiserLeaveAllowed = isOrganiserById && (sesh.game_type === 'private' || sesh.game_type === 'open')
    if (leavingAsOrganiser && !organiserLeaveAllowed) {
      return NextResponse.json({ error: 'The organiser cannot leave their own session' }, { status: 403 })
    }

    // Release the saved payment method in Stripe so the player cannot be charged
    if (player.stripe_payment_method_id) {
      try {
        await stripe.paymentMethods.detach(player.stripe_payment_method_id)
      } catch (err) {
        // Non-fatal — removal from the players table is the authoritative release
        console.error('Stripe paymentMethod detach failed:', err)
      }
    }

    // Remove from session
    const { error: deleteError } = await svc
      .from('players')
      .delete()
      .eq('id', player.id)

    if (deleteError) {
      console.error('Player delete error:', deleteError.message)
      return NextResponse.json({ error: 'Failed to leave session' }, { status: 500 })
    }

    // If the organiser is leaving, promote the earliest-joined remaining player to
    // organiser (by name/phone if they're a guest) instead of leaving the game
    // leaderless — the game still needs someone to be the point of contact.
    let newOrganiserName: string | null = null
    if (organiserLeaveAllowed) {
      const { data: nextOrganiser } = await svc
        .from('players')
        .select('user_id, name, phone')
        .eq('session_id', sessionId)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      newOrganiserName = (nextOrganiser as { name: string | null } | null)?.name ?? null
      await svc.from('sessions').update({
        organiser_id: (nextOrganiser as { user_id: string | null } | null)?.user_id ?? null,
        organiser_name: newOrganiserName,
        organiser_phone: (nextOrganiser as { phone: string | null } | null)?.phone ?? null,
      }).eq('id', sessionId)
    }

    const { count: afterCount } = await svc
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    // Auto-cancel empty open or private sessions so they disappear immediately
    if ((afterCount ?? 0) === 0 && (sesh.game_type === 'open' || sesh.game_type === 'private')) {
      await svc.from('sessions').update({ status: 'cancelled', is_public: false }).eq('id', sessionId)
      return NextResponse.json({ ok: true })
    }

    // Notify every remaining player with an account about who left — not just
    // the organiser, since anyone in the game may want to find a replacement.
    const { data: remainingPlayers } = await svc
      .from('players')
      .select('user_id')
      .eq('session_id', sessionId)
      .not('user_id', 'is', null)

    if (remainingPlayers && remainingPlayers.length > 0) {
      const leaveMessage = organiserLeaveAllowed
        ? `The organiser has left, ${(newOrganiserName ?? 'a player').split(' ')[0]} is now the organiser.`
        : 'A player has dropped out, the game needs one more player to confirm.'
      await svc.from('notifications').insert(
        (remainingPlayers as unknown as { user_id: string }[]).map(p => ({
          user_id: p.user_id,
          session_id: sessionId,
          message: leaveMessage,
        }))
      )
    }

    const firstName = player.name?.split(' ')[0] ?? 'A player'
    const needed = Math.max(1, 10 - (afterCount ?? 0))
    const plural = needed === 1 ? 'player' : 'players'

    await svc.from('messages').insert({
      session_id: sessionId,
      content: `${firstName} left the game, ${needed} more ${plural} needed`,
      user_id: null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
