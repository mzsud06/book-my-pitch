'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AuthUser {
  name: string
  email: string
}

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const isOwnerArea = pathname?.startsWith('/owner')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.name ?? '',
          email: data.user.email ?? '',
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser({
          name: session.user.user_metadata?.name ?? '',
          email: session.user.email ?? '',
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setDropdownOpen(false)
    setUser(null)
    router.push('/')
    router.refresh()
  }

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || ''
  const initial = firstName[0]?.toUpperCase() ?? '?'

  if (isOwnerArea) return null

  return (
    <nav
      className="anim-fade-in"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 'clamp(0.75rem, 2vw, 1.25rem)',
        paddingRight: 'clamp(1.25rem, 4vw, 2rem)',
        height: '60px',
        borderTop: '2px solid var(--green)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 300,
        background: 'rgba(8,8,8,0.96)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            minHeight: '44px',
          }}
        >
          <img src="/logo.png" alt="BookMyPitch" style={{ height: '48px', width: 'auto', display: 'block' }} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(15px, 3.5vw, 18px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            Book<span style={{ color: '#C6F135' }}>My</span>Pitch
            <span
              style={{
                color: 'var(--text-secondary)',
                opacity: 0.75,
                fontSize: '0.72em',
                fontWeight: 600,
                letterSpacing: '0',
                marginLeft: '1px',
              }}
            >
              .uk
            </span>
          </span>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {user ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                className="profile-btn"
                onClick={() => setDropdownOpen(o => !o)}
                aria-label="Account menu"
                aria-expanded={dropdownOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '5px 12px 5px 5px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--text)',
                  transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.1s ease',
                  minHeight: '44px',
                }}
              >
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </span>
                <span style={{ letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>
                  {firstName}
                </span>
              </button>

              {dropdownOpen && (
                <div
                  className="nav-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '6px',
                    minWidth: '236px',
                    zIndex: 400,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Profile header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 10px 12px',
                      marginBottom: '4px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: 'var(--green)',
                        color: 'var(--black)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '17px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {initial}
                    </span>
                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '14px',
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          letterSpacing: '-0.01em',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {user.name || firstName}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 500,
                        }}
                      >
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/my-bookings"
                    style={{ textDecoration: 'none' }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div
                      className="dropdown-item"
                      style={{
                        padding: '9px 12px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      My bookings
                    </div>
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="dropdown-item"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                      transition: 'all 0.12s',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="nav-link-ghost"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                  padding: '0.5rem 0.25rem',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Log in
              </Link>
            </>
          )}
        </div>
    </nav>
  )
}
