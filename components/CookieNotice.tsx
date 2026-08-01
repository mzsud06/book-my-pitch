'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { hasCookieNoticeBeenDismissed, dismissCookieNotice } from '@/lib/clientStorage'

// Informational only, not an accept/reject consent gate — every cookie and
// local-storage use on this site is strictly necessary (sign-in, payment
// fraud prevention, guest-booking continuity), none are for tracking or
// advertising, so there's nothing non-essential to ask opt-in consent for.
// UK PECR still requires telling visitors clearly, which this does.
export default function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // localStorage is only reachable client-side, so checking it has to run
    // in an effect — this mirrors the same pattern used for the owner-signup
    // draft restore (see app/owner/signup/page.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasCookieNoticeBeenDismissed()) setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        position: 'fixed',
        left: '1rem',
        right: '1rem',
        bottom: '1rem',
        zIndex: 500,
        maxWidth: '640px',
        margin: '0 auto',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '1rem 1.25rem',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.5, flex: 1, minWidth: '220px' }}>
        We only use essential cookies (staying signed in, secure payments) and local storage (remembering guest bookings) to run the site — no tracking or advertising.{' '}
        <Link href="/privacy#cookies" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Learn more</Link>
      </div>
      <button
        type="button"
        onClick={() => { dismissCookieNotice(); setVisible(false) }}
        className="btn-g"
        style={{
          flexShrink: 0,
          padding: '0.6rem 1.1rem',
          fontSize: '13px',
          fontWeight: 800,
          borderRadius: '10px',
          border: 'none',
          background: 'var(--green)',
          color: 'var(--black)',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
        }}
      >
        Got it
      </button>
    </div>
  )
}
