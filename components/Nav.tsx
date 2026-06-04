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
    <>
      <nav
        className="anim-fade-in"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.95rem 1.5rem',
          borderTop: '2px solid var(--green)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 300,
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '19px',
              letterSpacing: '-0.03em',
              cursor: 'pointer',
              userSelect: 'none',
              color: 'var(--text)',
            }}
          >
            Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
            <span style={{ color: 'var(--green)' }}>.uk</span>
          </span>
        </Link>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {user ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                className="profile-btn"
                onClick={() => setDropdownOpen(o => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: "'Archivo', sans-serif",
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '0.35rem 0.8rem 0.35rem 0.35rem',
                  borderRadius: '20px',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--text)',
                  transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.1s ease',
                }}
              >
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: "'Archivo Black', sans-serif",
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </span>
                {firstName}
              </button>

              {dropdownOpen && (
                <div
                  className="nav-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '6px',
                    minWidth: '224px',
                    zIndex: 400,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
                  }}
                >
                  {/* Profile header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '0.8rem',
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
                        fontWeight: 800,
                        fontFamily: "'Archivo Black', sans-serif",
                      }}
                    >
                      {initial}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
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
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        fontWeight: 600,
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
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                      fontFamily: "'Archivo', sans-serif",
                      fontWeight: 600,
                      transition: 'all 0.12s',
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
                  fontFamily: "'Archivo', sans-serif",
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--muted)',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                Login / Sign up
              </Link>
              <Link href="/slots" style={{ textDecoration: 'none' }}>
                <button
                  className="nav-btn-green"
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '-0.02em',
                    padding: '0.5rem 1.15rem',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Find a slot →
                </button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
