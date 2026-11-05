import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PitchArt } from '@/components/PitchArt'
import { surfaceShort } from '@/lib/labels'

export interface GameCardData {
  id: string
  title: string
  dateLabel: string
  timeLabel: string
  venueName: string
  venueAddress?: string
  photoUrl?: string | null
  /** Full amount each player is charged, fees included, e.g. "£3.80". */
  pricePerPlayer: string
  playerCount: number
  maxPlayers: number
  format?: string
  surface?: string
  durationMins: number
  isFull: boolean
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }}>
      <path d={d} />
    </svg>
  )
}

export function GameCard({ game }: { game: GameCardData }) {
  const spotsLeft = Math.max(0, game.maxPlayers - game.playerCount)
  const pct = game.maxPlayers > 0 ? Math.min(100, Math.round((game.playerCount / game.maxPlayers) * 100)) : 0
  const fillingFast = !game.isFull && pct >= 70

  return (
    <article className="game-card" style={{ background: '#FFFFFF', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ position: 'relative', height: '180px', flexShrink: 0 }}>
        {game.photoUrl ? (
          <Image src={game.photoUrl} alt={game.venueName} fill sizes="(max-width: 640px) 100vw, 320px" style={{ objectFit: 'cover' }} />
        ) : (
          <PitchArt tone="cobalt" label={`${game.venueName}: photo coming soon`} />
        )}
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,17,48,0.75) 0%, rgba(11,17,48,0) 55%)' }} />
        <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
          {game.isFull ? <Badge variant="hot">Full</Badge> : fillingFast ? <Badge variant="hot">Filling fast</Badge> : null}
        </div>
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#FFFFFF', color: 'var(--ink)', borderRadius: '999px', padding: '4px 11px', fontSize: '14px', fontWeight: 700 }}>
          {game.playerCount}/{game.maxPlayers}
        </div>
        <div style={{ position: 'absolute', left: '14px', bottom: '10px', color: '#FFFFFF', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span className="wide" style={{ fontSize: '30px', lineHeight: 1, fontWeight: 900 }}>{game.pricePerPlayer}</span>
          <span style={{ fontSize: '14px', opacity: 0.92 }}>a player, fees included</span>
        </div>
      </div>

      <div style={{ padding: '1rem 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {game.format && <Badge variant="solid">{game.format}</Badge>}
          {game.surface && <Badge variant="neutral">{surfaceShort(game.surface)}</Badge>}
        </div>
        <h3 style={{ fontSize: '1.25rem', margin: '0.1rem 0 0', lineHeight: 1.15 }}>{game.title}</h3>
        <div style={{ display: 'flex', gap: '8px', fontSize: '15px', color: 'var(--text-secondary)' }}>
          <Icon d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          <span>{game.dateLabel} · {game.timeLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '15px', color: 'var(--text-secondary)' }}>
          <Icon d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          <span>{game.venueName}{game.venueAddress ? `, ${game.venueAddress}` : ''}</span>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{game.isFull ? 'No spots left' : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}</span>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{game.durationMins} min</span>
          </div>
          <div style={{ height: '6px', borderRadius: '99px', background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '99px', background: game.isFull || fillingFast ? 'var(--coral)' : 'var(--green)' }} />
          </div>
          <div style={{ marginTop: '0.9rem' }}>
            {game.isFull ? (
              <Button variant="secondary" block disabled style={{ cursor: 'default', color: 'var(--text-secondary)' }}>Game full</Button>
            ) : (
              <Link href={`/session/${game.id}`} style={{ textDecoration: 'none', display: 'block' }} aria-label={`Join ${game.title} at ${game.venueName}`}>
                <Button variant="brand" block>Join game</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
