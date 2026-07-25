import Link from 'next/link'
import Nav from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { seedSlotsForAllVenues } from '@/lib/seedSlots'
import { formatPerPlayer } from '@/lib/slots'

interface VenueRow {
  id: string
  name: string
  address: string
  pitches: { format: string; offpeak_price: number; max_players: number }[]
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 14.5s5-4.2 5-8.2A5 5 0 0 0 3 6.3c0 4 5 8.2 5 8.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="6.3" r="1.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export default async function SlotsPage() {
  const supabase = await createClient()
  const svc = createServiceClient()

  // Ensure every venue/pitch in the DB has slots seeded for the next 14 days.
  // Reusable per venue/pitch — a new venue only needs a database insert.
  await seedSlotsForAllVenues(svc)

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, address, pitches(format, offpeak_price, max_players)')
    .order('created_at', { ascending: true })

  return (
    <>
      <Nav />
      <div style={{ paddingBottom: '5rem' }}>
        <Container>
          <div style={{ paddingTop: 'clamp(2.5rem, 6vh, 3.5rem)', paddingBottom: 'clamp(4rem, 8vh, 6rem)' }}>

            <div className="anim-fade-up" style={{ marginBottom: '2.5rem', maxWidth: '640px' }}>
              <SectionHeading
                eyebrow="Venues"
                heading="Pick a pitch"
                sub="Choose a venue to see available times and book your game."
              />
            </div>

            <div className="venue-grid">
              {((venues ?? []) as unknown as VenueRow[]).map((venue, idx) => {
                const formats = Array.from(new Set(venue.pitches.map(p => p.format)))
                const cheapestPitch = venue.pitches.reduce<{ offpeak_price: number; max_players: number } | null>(
                  (min, p) => (!min || p.offpeak_price / p.max_players < min.offpeak_price / min.max_players ? p : min),
                  null
                )
                return (
                  <Card
                    key={venue.id}
                    hover
                    className="anim-fade-up"
                    style={{ overflow: 'hidden', animationDelay: `${idx * 60}ms`, display: 'flex', flexDirection: 'column' }}
                  >
                    <div
                      style={{
                        aspectRatio: '4 / 3',
                        backgroundImage: "url('/slot-card.jpg')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <h3
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '20px',
                          fontWeight: 700,
                          letterSpacing: '-0.015em',
                          color: 'var(--text)',
                          margin: '0 0 8px',
                        }}
                      >
                        {venue.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        <PinIcon />
                        <p style={{ fontSize: '13px', margin: 0, fontWeight: 500 }}>
                          {venue.address}
                        </p>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '1.5rem' }}>
                        {formats.join(' · ')}
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '0.25rem', marginBottom: '1.25rem' }}>
                        {cheapestPitch && (
                          <>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: '2px' }}>
                              Starts from
                            </div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--green)' }}>
                              {formatPerPlayer(cheapestPitch.offpeak_price, cheapestPitch.max_players)}{' '}
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>per player</span>
                            </div>
                          </>
                        )}
                      </div>

                      <Link href={`/slots/${venue.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <Button variant="primary" size="md" arrow style={{ width: '100%' }}>
                          Book a slot
                        </Button>
                      </Link>
                    </div>
                  </Card>
                )
              })}
            </div>

          </div>
        </Container>
      </div>
      <Footer />
    </>
  )
}
