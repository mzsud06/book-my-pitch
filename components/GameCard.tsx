import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { SquadStrip, LockIcon, CheckIcon } from '@/components/SquadStrip'

export interface GameCardProps {
  /** Where tapping the card goes. Omit for a non-clickable example card. */
  href?: string
  photo?: string
  title: string
  venue: string
  area?: string
  date: string
  time: string
  /** Already formatted, e.g. "£6.00" */
  price: string
  filled: number
  total: number
  format?: string
  isFull?: boolean
  /** Extra badge slot, e.g. peak / off-peak */
  badge?: ReactNode
  priority?: boolean
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 14.5s5-4.2 5-8.2A5 5 0 0 0 3 6.3c0 4 5 8.2 5 8.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8" cy="6.3" r="1.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function GameCard({
  href, photo = '/game-card.jpg', title, venue, area, date, time, price,
  filled, total, format, isFull = false, badge, priority = false,
}: GameCardProps) {
  const left = Math.max(0, total - filled)
  const status = isFull ? 'confirmed' : 'filling'
  const urgent = !isFull && left > 0 && left <= 3

  const body = (
    <>
      <div className="game-card-photo">
        <Image
          src={photo}
          alt=""
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 380px"
          style={{ objectFit: 'cover' }}
          priority={priority}
        />
        <span className="game-chip" style={{ left: 12, bottom: 12, zIndex: 1 }}>
          {date} · {time}
        </span>
        {format && (
          <span className="game-chip game-chip--light" style={{ right: 12, top: 12 }}>
            {format}
          </span>
        )}
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontStretch: '75%', fontSize: 22, fontWeight: 800,
              lineHeight: 1.1, margin: 0, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </h3>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minWidth: 0,
              fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
            }}>
              <PinIcon />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {venue}{area ? ` · ${area}` : ''}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="tabular" style={{
              fontFamily: 'var(--font-display)', fontStretch: '75%', fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--ink)',
            }}>
              {price}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: 3 }}>
              per player
            </div>
          </div>
        </div>

        <div>
          <SquadStrip filled={filled} total={total} status={status} size="sm" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <span className="tabular" style={{
              fontSize: 13, fontWeight: 700,
              color: isFull ? 'var(--ink)' : urgent ? '#B83208' : 'var(--text-secondary)',
            }}>
              {isFull ? `${filled}/${total} · Confirmed` : left === 0 ? `${filled}/${total}` : `${filled}/${total} · ${left} ${left === 1 ? 'spot' : 'spots'} left`}
            </span>
            {badge}
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          {href ? (
            isFull ? (
              <span className="game-join is-confirmed"><CheckIcon size={16} /> Game on</span>
            ) : (
              <span className="game-join">Join · {price}</span>
            )
          ) : (
            <span className="game-join is-off">Example game</span>
          )}
          {href && !isFull && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><LockIcon size={12} /></span>
              Held now, charged only if the game fills
            </div>
          )}
        </div>
      </div>
    </>
  )

  const cls = `game-card${isFull ? ' is-confirmed' : ''}`
  return href && !isFull ? (
    <Link href={href} className={cls}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
