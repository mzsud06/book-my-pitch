import Nav from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { seedSlotsForAllVenues } from '@/lib/seedSlots'
import { VenuesBrowser } from './VenuesBrowser'
import type { VenueCardData } from '@/components/VenueCard'

export default async function SlotsPage() {
  const supabase = await createClient()
  const svc = createServiceClient()

  // Ensure every venue/pitch in the DB has slots seeded for the next 14 days.
  // Reusable per venue/pitch — a new venue only needs a database insert.
  await seedSlotsForAllVenues(svc)

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, address, pitches(format, surface, offpeak_price, max_players)')
    .order('created_at', { ascending: true })

  return (
    <>
      <Nav />
      <VenuesBrowser venues={(venues ?? []) as unknown as VenueCardData[]} />
      <Footer />
    </>
  )
}
