import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, phone } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const svc = createServiceClient()

    // Verify session exists and is still filling
    const { data: session } = await svc
      .from('sessions')
      .select('id, status, organiser_name, organiser_phone')
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
      stripe_payment_method_id: string | null
      stripe_customer_id: string | null
    }
    let player: PlayerRow | null = null

    if (user?.id) {
      const { data } = await svc
        .from('players')
        .select('id, name, phone, stripe_payment_method_id, stripe_customer_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle()
      player = data as PlayerRow | null
    } else if (phone) {
      const { data } = await svc
        .from('players')
        .select('id, name, phone, stripe_payment_method_id, stripe_customer_id')
        .eq('session_id', sessionId)
        .eq('phone', phone)
        .maybeSingle()
      player = data as PlayerRow | null
    } else {
      return NextResponse.json({ error: 'Cannot identify player' }, { status: 401 })
    }

    if (!player) {
      return NextResponse.json({ error: 'You are not in this session' }, { status: 404 })
    }

    // Organisers cannot leave their own session
    const sesh = session as { organiser_name: string | null; organiser_phone: string | null }
    const isOrganiserByPhone = sesh.organiser_phone && player.phone && player.phone === sesh.organiser_phone
    const isOrganiserByName = sesh.organiser_name && player.name?.toLowerCase() === sesh.organiser_name.toLowerCase()
    if (isOrganiserByPhone || isOrganiserByName) {
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
      console.error('Player delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to leave session' }, { status: 500 })
    }

    // Count players remaining (includes organiser row if they've completed setup)
    const { count: remaining } = await svc
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    const needed = Math.max(1, 10 - (remaining ?? 0))
    const firstName = player.name?.split(' ')[0] ?? 'A player'
    const plural = needed === 1 ? 'player' : 'players'

    // Notify via messages table so the organiser is informed
    await svc.from('messages').insert({
      session_id: sessionId,
      content: `${firstName} left the game — ${needed} more ${plural} needed`,
      user_id: null,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('leave error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
