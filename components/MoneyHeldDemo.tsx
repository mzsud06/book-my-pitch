'use client'

import { useEffect, useState } from 'react'
import { SquadStrip, LockIcon, ConfirmedStamp } from '@/components/SquadStrip'

// Illustrative only. No data, no payments: a looping picture of
// "money held, not taken" so a player or a venue owner gets it in 3 seconds.
//
//   Game A: fills to 10/10 -> flips volt -> "£60 charged. Game on."
//   Game B: stalls at 7/10 -> deadline passes -> "Nobody paid."

const TOTAL = 10
const PRICE = 6
const B_STALL = 7

const T_CONFIRM = 10     // tick A reaches 10/10 and confirms
const T_EXPIRE = 14      // tick B's deadline passes
const T_RESET = 20       // loop restarts
const TICK_MS = 430

function stateAt(t: number) {
  const a = Math.min(t, TOTAL)
  const aConfirmed = t >= T_CONFIRM
  const bExpired = t >= T_EXPIRE
  const b = bExpired ? 0 : Math.min(t, B_STALL)
  return { a, aConfirmed, b, bExpired }
}

export default function MoneyHeldDemo() {
  // null = the finished picture, so no-JS and reduced-motion users still see the point.
  const [tick, setTick] = useState<number | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setTick(prev => (prev === null ? 0 : (prev + 1) % T_RESET)), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const { a, aConfirmed, b, bExpired } = stateAt(tick ?? T_CONFIRM + 2)
  // B keeps showing what was held until the deadline passes, then it empties.
  const bHeld = bExpired ? 0 : b

  return (
    <div className="mh-grid" aria-label="How a game fills or fails">
      {/* Game A: fills */}
      <div className={`mh-panel${aConfirmed ? ' is-confirmed' : ''}`}>
        <PanelHead title="Thu 19:00 · 5-a-side" caption="The game fills" />
        <SquadStrip filled={a} total={TOTAL} status={aConfirmed ? 'confirmed' : 'filling'} size="lg" />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14, minHeight: 52 }}>
          <div>
            <div className="mh-money" style={{ color: 'var(--ink)' }}>
              £{a * PRICE}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>
              {aConfirmed ? <>Charged to all {TOTAL} players</> : <><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><LockIcon size={13} /></span> Held, not taken</>}
            </div>
          </div>
          {aConfirmed ? <ConfirmedStamp animated /> : <Count n={a} total={TOTAL} />}
        </div>
      </div>

      {/* Game B: does not fill */}
      <div className={`mh-panel${bExpired ? ' is-expired' : ''}`}>
        <PanelHead title="Fri 20:00 · 5-a-side" caption="The game doesn't" />
        <SquadStrip filled={b} total={TOTAL} status={bExpired ? 'expired' : 'filling'} size="lg" />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14, minHeight: 52 }}>
          <div>
            <div className="mh-money" style={{ color: bExpired ? 'var(--text-tertiary)' : 'var(--ink)' }}>
              £{bExpired ? 0 : bHeld * PRICE}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>
              {bExpired ? <>Not enough players. Nobody paid.</> : <><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><LockIcon size={13} /></span> Held, not taken</>}
            </div>
          </div>
          {bExpired ? (
            <span style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', border: '1.5px solid var(--border-strong)', borderRadius: 6, padding: '5px 9px' }}>
              Cancelled
            </span>
          ) : (
            <Count n={b} total={TOTAL} />
          )}
        </div>
      </div>
    </div>
  )
}

function PanelHead({ title, caption }: { title: string; caption: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 18, letterSpacing: '0.01em' }}>
        {title}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {caption}
      </span>
    </div>
  )
}

function Count({ n, total }: { n: number; total: number }) {
  return (
    <span className="tabular" style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>
      {n}<span style={{ color: 'var(--text-tertiary)' }}>/{total}</span>
    </span>
  )
}
