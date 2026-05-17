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
      <style>{`
        .nav-btn-ghost:hover { color: var(--text) !important; border-color: rgba(255,255,255,0.18) !important; }
        .nav-btn-green:hover { background: var(--green-dim) !important; transform: translateY(-1px); }
        .profile-btn:hover { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.04) !important; }
        .dropdown-item:hover { background: var(--surface2) !important; color: var(--text) !important; }
      `}</style>
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 300,
        background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(20px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '18px', letterSpacing: '-0.5px', cursor: 'pointer', userSelect: 'none', color: 'var(--text)' }}>
            Book<span style={{ color: 'var(--green)' }}>My</span>Pitch<span style={{ color: 'var(--green)' }}>.uk</span>
          </span>
        </Link>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {user ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                className="profile-btn"
                onClick={() => setDropdownOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '13px',
                  padding: '0.4rem 0.75rem 0.4rem 0.4rem',
                  borderRadius: '20px', border: '1px solid var(--border)',
                  cursor: 'pointer', background: 'transparent', color: 'var(--text)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: 'var(--green)', color: 'var(--black)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, flexShrink: 0,
                }}>
                  {initial}
                </span>
                {firstName}
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '6px',
                  minWidth: '220px', zIndex: 400,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  {/* Profile header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '0.75rem', marginBottom: '4px',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{
                      width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                      background: 'var(--green)', color: 'var(--black)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '17px', fontWeight: 700,
                    }}>
                      {initial}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.name || firstName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.email}
                      </div>
                    </div>
                  </div>

                  {/* My bookings */}
                  <Link
                    href="/my-bookings"
                    style={{ textDecoration: 'none' }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div className="dropdown-item" style={{
                      padding: '0.6rem 0.75rem', borderRadius: '7px',
                      fontSize: '14px', color: 'var(--muted)', cursor: 'pointer',
                      transition: 'all 0.1s', fontWeight: 500,
                    }}>
                      My bookings
                    </div>
                  </Link>

                  {/* Sign out */}
                  <button
                    onClick={handleSignOut}
                    className="dropdown-item"
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '0.6rem 0.75rem', borderRadius: '7px',
                      fontSize: '14px', color: 'var(--muted)', cursor: 'pointer',
                      background: 'transparent', border: 'none',
                      fontFamily: "'Archivo', sans-serif", fontWeight: 500,
                      transition: 'all 0.1s',
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login" style={{ textDecoration: 'none' }}>
                <button className="nav-btn-ghost" style={{
                  fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '13px',
                  padding: '0.5rem 1.1rem', borderRadius: '6px', border: '1px solid var(--border)',
                  cursor: 'pointer', background: 'transparent', color: 'var(--muted)', transition: 'all 0.15s',
                }}>
                  Login / Sign up
                </button>
              </Link>
              <Link href="/slots" style={{ textDecoration: 'none' }}>
                <button className="nav-btn-green" style={{
                  fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '13px',
                  padding: '0.5rem 1.1rem', borderRadius: '6px', border: 'none',
                  cursor: 'pointer', background: 'var(--green)', color: 'var(--black)', transition: 'all 0.15s',
                }}>
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
