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

interface VenueRow {
  id: string
  name: string
  address: string
  pitches: { format: string }[]
}

export default async function SlotsPage() {
  const supabase = await createClient()
  const svc = createServiceClient()

  // Ensure every venue/pitch in the DB has slots seeded for the next 14 days.
  // Reusable per venue/pitch — a new venue only needs a database insert.
  await seedSlotsForAllVenues(svc)

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, address, pitches(format)')
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
                return (
                  <Card
                    key={venue.id}
                    hover
                    className="anim-fade-up"
                    style={{ overflow: 'hidden', animationDelay: `${idx * 60}ms` }}
                  >
                    <div
                      style={{
                        height: '160px',
                        backgroundImage: "url('/slot-card.jpg')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div style={{ padding: '1.25rem' }}>
                      <h3
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '19px',
                          fontWeight: 700,
                          letterSpacing: '-0.015em',
                          color: 'var(--text)',
                          margin: '0 0 6px',
                        }}
                      >
                        {venue.name}
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px', fontWeight: 500 }}>
                        {venue.address}
                      </p>
                      <div style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600, marginBottom: '1.25rem' }}>
                        {formats.join(' · ')}
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
