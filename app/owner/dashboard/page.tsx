import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import OwnerDashboardClient from './OwnerDashboardClient'
import { getSlotType, isSlotInPast } from '@/lib/slots'
import { expireIfStale } from '@/lib/expireSessions'
import { stripe } from '@/lib/stripe'

interface RawSession {
  id: string
  status: string
  created_at: string
  slots: unknown
  players: unknown
  bookings: unknown
}

interface SlotField {
  date: string
  start_time: string
  end_time: string
  price: number
  venue_id: string
  pitches: { max_players: number }
}

function getSlot(slots: unknown): SlotField | null {
  if (!slots) return null
  if (Array.isArray(slots)) return slots[0] as SlotField ?? null
  return slots as SlotField
}

export default async function OwnerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/owner/login')

  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!venue) redirect('/owner/login')

  // Self-healing onboarding status: the venue can have a stripe_account_id
  // long before Stripe has actually verified it. Rather than requiring a
  // webhook, check live on every dashboard load while still incomplete —
  // cheap (one Stripe API call, only while flag is false) and correctness-
  // critical, since triggerPayments refuses to transfer to an unverified
  // account (see lib/triggerPayments.ts).
  let stripeOnboardingComplete = Boolean((venue as { stripe_onboarding_complete?: boolean }).stripe_onboarding_complete)
  const stripeAccountId = (venue as { stripe_account_id?: string | null }).stripe_account_id
  if (stripeAccountId && !stripeOnboardingComplete) {
    try {
      const account = await stripe.accounts.retrieve(stripeAccountId)
      if (account.details_submitted && account.charges_enabled) {
        await supabase.from('venues').update({ stripe_onboarding_complete: true }).eq('id', venue.id)
        stripeOnboardingComplete = true
      }
    } catch (err) {
      console.error('owner-dashboard: failed to check Stripe account status:', err)
    }
  }

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const { data: rawSessions } = await supabase
    .from('sessions')
    .select(`
      id, status, created_at, organiser_name,
      slots!inner(id, date, start_time, end_time, price, venue_id, pitches(max_players)),
      players(id, name, joined_at),
      bookings(id, confirmed_at)
    `)
    .eq('slots.venue_id', venue.id)
    .order('slots(date)', { ascending: false })
    .limit(50)

  const { data: rawWeekSessions } = await supabase
    .from('sessions')
    .select(`
      id, status,
      slots!inner(id, date, start_time, end_time, price, venue_id, pitches(max_players)),
      players(count)
    `)
    .eq('slots.venue_id', venue.id)
    .gte('slots.date', weekStart.toISOString().split('T')[0])
    .lte('slots.date', weekEnd.toISOString().split('T')[0])

  const sessions = (rawSessions ?? []) as unknown as RawSession[]
  const weekSessions = (rawWeekSessions ?? []) as unknown as RawSession[]

  // A 'filling' session whose slot has already started is stale — nothing
  // sweeps it automatically until someone visits its session page, so without
  // this the "Currently filling / Live" panel would keep showing games whose
  // time has already passed. Sweep those (flips their DB status) and treat
  // them as expired for every stat/list derived below.
  const staleIds = new Set<string>()
  for (const s of [...sessions, ...weekSessions]) {
    if (s.status !== 'filling' || staleIds.has(s.id)) continue
    const slot = getSlot(s.slots)
    if (slot && isSlotInPast(slot.date, slot.start_time)) staleIds.add(s.id)
  }
  if (staleIds.size > 0) {
    const byId = new Map([...sessions, ...weekSessions].map(s => [s.id, s]))
    await Promise.all(Array.from(staleIds, id => {
      const s = byId.get(id)!
      const slot = getSlot(s.slots)!
      return expireIfStale(id, slot.date, slot.start_time)
    }))
    for (const s of [...sessions, ...weekSessions]) {
      if (staleIds.has(s.id)) s.status = 'expired'
    }
  }

  const confirmedThisWeek = weekSessions.filter(s => s.status === 'confirmed')
  const revenueThisWeek = confirmedThisWeek.reduce((sum, s) => {
    const slot = getSlot(s.slots)
    return sum + (slot?.price ?? 0)
  }, 0)

  const allConfirmed = sessions.filter(s => s.status === 'confirmed')
  const totalRevenue = allConfirmed.reduce((sum, s) => {
    const slot = getSlot(s.slots)
    return sum + (slot?.price ?? 0)
  }, 0)

  const slotOccupancy = new Map<string, { confirmed: number; total: number; type: string }>()
  weekSessions.forEach(s => {
    const slot = getSlot(s.slots)
    if (!slot) return
    const key = slot.start_time
    if (!slotOccupancy.has(key)) slotOccupancy.set(key, { confirmed: 0, total: 0, type: getSlotType(slot.date, slot.start_time) })
    const entry = slotOccupancy.get(key)!
    entry.total++
    if (s.status === 'confirmed') entry.confirmed++
  })

  const occupancyData = Array.from(slotOccupancy.entries())
    .map(([time, data]) => ({ time, ...data }))
    .sort((a, b) => a.time.localeCompare(b.time))

  // Build typed sessions for client
  const typedSessions = sessions.map(s => {
    const slot = getSlot(s.slots)
    const players = Array.isArray(s.players) ? s.players as { id: string; name: string; joined_at: string }[] : []
    const bookings = Array.isArray(s.bookings) ? s.bookings as { id: string; confirmed_at: string }[] : []
    return {
      id: s.id,
      status: s.status,
      created_at: s.created_at,
      organiser_name: (s as unknown as { organiser_name?: string | null }).organiser_name ?? null,
      slots: slot
        ? { ...slot, type: getSlotType(slot.date, slot.start_time), max_players: slot.pitches.max_players }
        : { date: '', start_time: '', end_time: '', type: '', price: 0, max_players: 10 },
      players,
      bookings,
    }
  })

  return (
    <>
      <Nav />
      <OwnerDashboardClient
        venue={{ ...venue, stripe_onboarding_complete: stripeOnboardingComplete }}
        sessions={typedSessions}
        stats={{
          confirmedThisWeek: confirmedThisWeek.length,
          revenueThisWeek,
          totalRevenue,
          fillRate: weekSessions.length > 0
            ? Math.round((confirmedThisWeek.length / weekSessions.length) * 100)
            : 0,
        }}
        occupancyData={occupancyData}
        weekDays={7}
      />
    </>
  )
}
