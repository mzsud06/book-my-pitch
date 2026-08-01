import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import SlotsClient, { SessionData, DbSlot } from './SlotsClient'
import { seedSlotsForVenue, cleanupExpiredSessions, ukDateStr, SLOT_SEED_DAYS } from '@/lib/seedSlots'
import { Pitch, scheduleFromVenue } from '@/lib/slots'

const PITCH_COLS = 'id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price'

interface Props {
  params: Promise<{ venueId: string }>
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default async function VenueSlotsPage({ params }: Props) {
  const { venueId } = await params
  const supabase = await createClient()
  // Service client used for write operations (upsert slots, delete expired sessions/players)
  // so these work regardless of RLS policies and the calling user's auth state.
  const svc = createServiceClient()

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address, stripe_onboarding_complete, admin_approved, opening_time, closing_time, weekend_opening_time, weekend_closing_time, peak_start_time, daily_hours, contact_phone, amenities, min_booking_notice_minutes, photo_url')
    .eq('id', venueId)
    .single()

  if (!venue) notFound()

  const schedule = scheduleFromVenue(venue)

  // A venue whose Stripe Connect onboarding isn't verified yet, or that
  // hasn't been manually approved, is filtered out of the /slots browse
  // list but is still reachable by direct link — block booking here too
  // rather than letting a group fill a slot that either can't actually
  // take payment (see lib/triggerPayments.ts) or hasn't been vetted as a
  // real pitch.
  if (!venue.stripe_onboarding_complete || !venue.admin_approved) {
    return (
      <>
        <Nav />
        <main style={{ position: 'relative', zIndex: 1 }}>
          <Container>
            <Card
              style={{
                textAlign: 'center',
                padding: '5rem 1.5rem',
                margin: 'clamp(2.5rem, 6vh, 3.5rem) 0',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '-0.03em', marginBottom: '0.6rem', color: 'var(--text)' }}>
                {venue.name} isn&apos;t accepting bookings yet
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '2rem', fontWeight: 500, lineHeight: 1.6 }}>
                This venue is still finishing setup. Check back soon, or browse other pitches.
              </div>
              <Link href="/slots" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" arrow>Browse other venues</Button>
              </Link>
            </Card>
          </Container>
        </main>
      </>
    )
  }

  const { data: pitches } = await supabase
    .from('pitches')
    .select(PITCH_COLS)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: true })

  const venuePitches = (pitches ?? []) as unknown as Pitch[]

  const today = new Date()
  const todayStr = ukDateStr(today)
  const endStr = ukDateStr(addDays(today, SLOT_SEED_DAYS))

  if (venuePitches.length > 0) {
    // Reusable per venue/pitch — ensures every slot template for the next 14
    // days exists in the DB, regardless of how many pitches this venue has.
    await seedSlotsForVenue(svc, venueId, venuePitches, schedule)
    await cleanupExpiredSessions(svc, venueId)
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Service client for the sessions read: the players(count) embed needs
  // table-level SELECT on players to run its count() aggregate, which anon/
  // authenticated deliberately don't have (only column-level grants on the
  // non-sensitive columns — see security-migration-3.sql). The anon-scoped
  // client 42501s on this query every time; svc bypasses RLS/grants outright,
  // same as the homepage and /public-games, which never hit this wall
  // because they already read via the service client.
  const [{ data: sessions }, { data: dbSlots }] = await Promise.all([
    svc
      .from('sessions')
      .select(`
        id,
        slot_id,
        organiser_id,
        status,
        organiser_name,
        is_public,
        game_type,
        slot_ids,
        slots!inner(id, date, start_time, end_time, price, max_players, venue_id, pitches(${PITCH_COLS})),
        players(count)
      `)
      .eq('slots.venue_id', venueId)
      .gte('slots.date', todayStr)
      .lte('slots.date', endStr)
      .in('status', ['filling', 'confirmed']),
    supabase
      .from('slots')
      .select(`id, date, start_time, price, pitches(${PITCH_COLS})`)
      .eq('venue_id', venueId)
      .gte('date', todayStr)
      .lte('date', endStr),
  ])

  // userSessionIds: all session ids the user is in (organiser OR player).
  // Used for the "✓ Joined" pill / "Your game" highlight in dropdown rows.
  const userSessionIds: string[] = []
  if (user) {
    const [{ data: asOrganiser }, { data: asPlayer }] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, slot_id')
        .eq('organiser_id', user.id)
        .in('status', ['filling', 'confirmed']),
      supabase
        .from('sessions')
        .select('id, slot_id, players!inner(user_id)')
        .eq('players.user_id', user.id)
        .in('status', ['filling', 'confirmed']),
    ])
    asOrganiser?.forEach(s => { userSessionIds.push(s.id) })
    ;(asPlayer as unknown as { id: string; slot_id: string }[] | null)
      ?.forEach(s => { userSessionIds.push(s.id) })
  }

  return (
    <>
      <Nav />
      <SlotsClient
        initialSessions={(sessions ?? []) as unknown as SessionData[]}
        dbSlots={(dbSlots ?? []) as unknown as DbSlot[]}
        venueId={venueId}
        venueName={venue.name}
        venueAddress={venue.address}
        pitches={venuePitches}
        schedule={schedule}
        amenities={(venue as unknown as { amenities: string[] }).amenities ?? []}
        contactPhone={(venue as unknown as { contact_phone: string | null }).contact_phone}
        minBookingNoticeMinutes={(venue as unknown as { min_booking_notice_minutes: number }).min_booking_notice_minutes ?? 0}
        photoUrl={(venue as unknown as { photo_url: string | null }).photo_url}
        userSessionIds={userSessionIds}
        userId={user?.id ?? null}
      />
    </>
  )
}
