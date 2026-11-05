import Link from 'next/link'
import Image from 'next/image'
import { PitchArt } from '@/components/PitchArt'
import { Badge } from '@/components/ui/Badge'

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

export function VenueCard({ venue }: { venue: VenueCardData; index?: number }) {
  const formats = Array.from(new Set(venue.pitches.map(p => p.format)))
  const cheapest = venue.pitches.reduce<number | null>((min, p) => (min === null || p.offpeak_price < min ? p.offpeak_price : min), null)

  return (
    <Link href={`/slots/${venue.id}`} className="venue-card-link" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <article className="game-card" style={{ background: '#FFFFFF', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', aspectRatio: '16 / 10' }}>
          {venue.photo_url ? (
            <Image src={venue.photo_url} alt={venue.name} fill sizes="(max-width: 640px) 100vw, 320px" style={{ objectFit: 'cover' }} />
          ) : (
            <PitchArt label={`${venue.name}: photo coming soon`} />
          )}
        </div>
        <div style={{ padding: '1.1rem 1.2rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <h3 style={{ fontSize: '1.3rem', margin: 0, lineHeight: 1.15, color: 'var(--text)' }}>{venue.name}</h3>
          <div style={{ display: 'flex', gap: '8px', fontSize: '15px', color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
            <span>{venue.address}</span>
          </div>
          {formats.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {formats.map(f => <Badge key={f} variant="neutral">{f}</Badge>)}
            </div>
          )}
          {cheapest !== null && (
            <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Starts from</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span className="wide" style={{ fontSize: '26px', fontWeight: 900, color: 'var(--green)' }}>£{cheapest % 1 === 0 ? cheapest : cheapest.toFixed(2)}</span>
                <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>an hour, split between players</span>
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}
