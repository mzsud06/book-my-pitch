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
        padding: '0 1.5rem',
        height: '58px',
        borderBottom: '1px solid var(--border)',
        borderTop: '3px solid var(--green)',
        position: 'sticky',
        top: 0,
        zIndex: 300,
        background: 'rgba(8,8,8,0.96)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0' }}>
        <span
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: '18px',
            letterSpacing: '-0.04em',
            cursor: 'pointer',
            userSelect: 'none',
            color: 'var(--text)',
            lineHeight: 1,
          }}
        >
          Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
          <span
            style={{
              color: 'var(--green)',
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.02em',
              verticalAlign: 'super',
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: "'Archivo', sans-serif",
                fontWeight: 700,
                fontSize: '13px',
                padding: '4px 12px 4px 4px',
                borderRadius: '100px',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--text)',
                transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.1s ease',
              }}
            >
              <span
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'var(--green)',
                  color: 'var(--black)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 900,
                  fontFamily: "'Archivo Black', sans-serif",
                  flexShrink: 0,
                }}
              >
                {initial}
              </span>
              <span style={{ letterSpacing: '-0.01em' }}>{firstName}</span>
            </button>

            {dropdownOpen && (
              <div
                className="nav-dropdown"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  background: '#141414',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '6px',
                  minWidth: '232px',
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
                      fontWeight: 900,
                      fontFamily: "'Archivo Black', sans-serif",
                    }}
                  >
                    {initial}
                  </span>
                  <div style={{ overflow: 'hidden', minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {user.name || firstName}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--muted)',
                        marginTop: '1px',
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
                      padding: '8px 10px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      fontWeight: 600,
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
                    padding: '8px 10px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    fontFamily: "'Archivo', sans-serif",
                    fontWeight: 600,
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
              href="/my-bookings"
              className="nav-link-ghost"
              style={{
                fontFamily: "'Archivo', sans-serif",
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--muted)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}
            >
              My bookings
            </Link>
            <Link
              href="/auth/login"
              className="nav-link-ghost"
              style={{
                fontFamily: "'Archivo', sans-serif",
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--muted)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}
            >
              Log in
            </Link>
            <Link href="/slots" style={{ textDecoration: 'none' }}>
              <button
                className="nav-btn-green"
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontWeight: 900,
                  fontSize: '13px',
                  letterSpacing: '-0.025em',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--green)',
                  color: 'var(--black)',
                  transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                }}
              >
                Find a slot →
              </button>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
