import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, PLAYER_FEE_PENCE } from '@/lib/stripe'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { GAME_COLS, GameRow, isValidUUID, paidSpots } from '@/lib/games'
import { getOrganiserStatus } from '@/lib/organiser'
import { expireIfNeeded } from '@/lib/gameLifecycle'

// Step 1 of joining: create the card hold (manual-capture PaymentIntent).
// The player's card is only authorised here, never charged. The organiser's
// connected account is the destination and the 79p fee stays with the platform.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!checkRateLimit(`hold:${getClientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  try {
    const { id } = await ctx.params
    if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid game' }, { status: 400 })

    const { name, phone } = await req.json()
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || trimmedName.length > 100 || !/^[A-Za-z\s'-]+$/.test(trimmedName)) {
      return NextResponse.json({ error: 'Enter your name' }, { status: 400 })
    }
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : ''
    if (!/^\+[0-9]{7,15}$/.test(trimmedPhone)) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
    }

    const svc = createServiceClient()
    const { data } = await svc.from('sessions').select(GAME_COLS).eq('id', id).maybeSingle()
    const game = data as GameRow | null
    if (!game || game.game_kind !== 'organiser') {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    const status = await expireIfNeeded(svc, game)
    if (status !== 'filling') {
      return NextResponse.json({ error: 'This game is no longer taking players' }, { status: 409 })
    }

    const { count } = await svc
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', id)
    if ((count ?? 0) >= paidSpots(game)) {
      return NextResponse.json({ error: 'This game is full' }, { status: 409 })
    }

    const organiser = await getOrganiserStatus(game.organiser_id!)
    if (!organiser.stripeAccountId || !organiser.ready) {
      return NextResponse.json({ error: "The organiser's payouts aren't set up yet" }, { status: 409 })
    }

    const share = game.share_pence!
    const intent = await stripe.paymentIntents.create({
      amount: share + PLAYER_FEE_PENCE,
      currency: 'gbp',
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      application_fee_amount: PLAYER_FEE_PENCE,
      transfer_data: { destination: organiser.stripeAccountId },
      description: `BookMyPitch: ${game.title ?? 'Football'} at ${game.venue_name} on ${game.game_date}`,
      metadata: { session_id: id, player_name: trimmedName, share_pence: String(share) },
    })

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: intent.amount,
    })
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      console.error('hold Stripe error:', { type: err.type, code: err.code, message: err.message })
    } else {
      console.error('hold error:', err)
    }
    return NextResponse.json({ error: 'Could not start the payment' }, { status: 500 })
  }
}
