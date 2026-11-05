import Nav from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { HomeView } from '@/components/home/HomeView'
import type { VenueCardData } from '@/components/VenueCard'
import { createClient } from '@/lib/supabase/server'
import { loadPublicGames } from '@/lib/publicGames'

export const revalidate = 0

async function loadVenues(): Promise<{ venues: VenueCardData[]; failed: boolean }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('venues')
      .select('id, name, address, photo_url, pitches(format, surface, offpeak_price, max_players)')
      .eq('stripe_onboarding_complete', true)
      .eq('admin_approved', true)
      .order('created_at', { ascending: true })
      .limit(4)
    if (error) return { venues: [], failed: true }
    return { venues: (data ?? []) as unknown as VenueCardData[], failed: false }
  } catch {
    return { venues: [], failed: true }
  }
}

export default async function HomePage() {
  const [games, { venues, failed }] = await Promise.all([loadPublicGames({ limit: 4 }), loadVenues()])
  return (
    <>
      <Nav />
      <HomeView games={games ?? []} venues={venues} venuesFailed={failed} />
      <Footer />
    </>
  )
}
