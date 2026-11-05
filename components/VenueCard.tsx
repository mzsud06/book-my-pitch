import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatPerPlayer } from '@/lib/slots'
import { Photo } from '@/components/ui/Photo'

export interface VenueCardPitch {
  format: string
  surface: string
  offpeak_price: number
  max_players: number
}

export interface VenueCardData {
  id: string
  name: string
  address: string
  photo_url?: string | null
  pitches: VenueCardPitch[]
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 14.5s5-4.2 5-8.2A5 5 0 0 0 3 6.3c0 4 5 8.2 5 8.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="6.3" r="1.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function VenueCard({ venue, index = 0 }: { venue: VenueCardData; index?: number }) {
  const formats = Array.from(new Set(venue.pitches.map(p => p.format)))
  const cheapestPitch = venue.pitches.reduce<VenueCardPitch | null>(
    (min, p) => (!min || p.offpeak_price / p.max_players < min.offpeak_price / min.max_players ? p : min),
    null
  )

  return (
    <Link
      href={`/slots/${venue.id}`}
      className="anim-fade-up"
      style={{ textDecoration: 'none', display: 'block', animationDelay: `${index * 60}ms` }}
    >
      <Card hover style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
        <Photo src={venue.photo_url} alt={venue.name} className="venue-card-photo" sizes="(max-width: 640px) 100vw, 380px" />
        <div style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: 'var(--text)',
              margin: '0 0 6px',
              }}
          >
            {venue.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '8px', minWidth: 0 }}>
            <PinIcon />
            <p
              style={{
                fontSize: '14px',
                margin: 0,
                fontWeight: 400,
                minWidth: 0,
              }}
            >
              {venue.address}
            </p>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 400, marginBottom: '0.75rem' }}>
            {formats.join(' · ')}
          </div>

          {cheapestPitch && (
            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: '2px' }}>
                From
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--green)' }}>
                {formatPerPlayer(cheapestPitch.offpeak_price, cheapestPitch.max_players)}{' '}
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>a player, plus fees</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}
