'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { hasCookieNoticeBeenDismissed, dismissCookieNotice } from '@/lib/clientStorage'

// Informational only, not an accept/reject consent gate: every cookie and
// local-storage use on this site is strictly necessary (sign-in, payment
// fraud prevention, guest-booking continuity). UK PECR still requires telling
// visitors clearly, which this does. It sits in normal page flow (not fixed)
// at the very end of the body, so it can never cover booking controls.
export default function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // localStorage is only reachable client-side, so checking it has to run in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasCookieNoticeBeenDismissed()) setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        background: 'var(--surface2)',
        borderTop: '1px solid var(--border)',
        padding: '0.75rem clamp(1.25rem, 4vw, 2rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem 1rem',
        flexWrap: 'wrap',
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}
    >
      <span>
        Essential cookies only, no tracking or ads.{' '}
        <Link href="/privacy#cookies" style={{ color: 'var(--green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>Details</Link>
      </span>
      <button
        type="button"
        onClick={() => { dismissCookieNotice(); setVisible(false) }}
        style={{
          padding: '0 1rem',
          fontSize: '14px',
          fontWeight: 600,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-strong)',
          background: 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Got it
      </button>
    </div>
  )
}
