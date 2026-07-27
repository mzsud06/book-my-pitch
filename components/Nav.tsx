'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface AuthUser {
  id: string
  name: string
  email: string
}

interface NotificationRow {
  id: string
  message: string
  read: boolean
  created_at: string
  session_id: string | null
}

function formatNotifTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/slots', label: 'Book a pitch' },
  { href: '/public-games', label: 'Public games' },
]

const SOCIALS = [
  {
    label: 'Instagram',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    label: 'X (Twitter)',
    icon: <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />,
  },
  {
    label: 'YouTube',
    icon: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="M10.2 9.3v5.4l4.8-2.7-4.8-2.7z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    label: 'Facebook',
    icon: <path d="M14.5 21v-7h2.3l.35-2.7H14.5V9.5c0-.78.22-1.3 1.33-1.3H17.3V5.8c-.24-.03-1.06-.1-2.02-.1-2 0-3.37 1.22-3.37 3.46v1.94H9.6v2.7h2.31V21h2.59z" fill="currentColor" stroke="none" />,
  },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const isOwnerArea = pathname?.startsWith('/owner')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          id: data.user.id,
          name: data.user.user_metadata?.name ?? '',
          email: data.user.email ?? '',
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
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
    const supabase = createClient()
    let cancelled = false

    async function loadNotifications() {
      if (!user) {
        if (!cancelled) {
          setNotifications([])
          setUnreadCount(0)
        }
        return
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (!cancelled) setUnreadCount(count ?? 0)

      const { data } = await supabase
        .from('notifications')
        .select('id, message, read, created_at, session_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (!cancelled) setNotifications((data ?? []) as NotificationRow[])
    }

    loadNotifications()
    return () => { cancelled = true }
  }, [user])

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

  useEffect(() => {
    if (!notifOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [mobileMenuOpen])

  async function handleNotificationClick(n: NotificationRow) {
    setNotifOpen(false)
    if (!n.read) {
      const supabase = createClient()
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnreadCount(c => Math.max(0, c - 1))
    }
    if (n.session_id) {
      router.push(`/session/${n.session_id}`)
    }
  }

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

        {/* Nav links (desktop) */}
        <div className="nav-links" style={{ gap: '4px', alignItems: 'center' }}>
          {NAV_LINKS.map(link => {
            const isActive = link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link-ghost"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                  padding: '0.5rem 0.75rem',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div ref={mobileMenuRef} className="nav-hamburger-wrap" style={{ position: 'relative' }}>
            <button
              onClick={() => { setDropdownOpen(false); setNotifOpen(false); setMobileMenuOpen(o => !o) }}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <path d="M18 6 6 18M6 6l12 12" />
                ) : (
                  <>
                    <path d="M3 6h18" />
                    <path d="M3 12h18" />
                    <path d="M3 18h18" />
                  </>
                )}
              </svg>
            </button>

            {mobileMenuOpen && (
              <div
                className="anim-fade-in"
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 500,
                  background: 'var(--black)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  style={{
                    position: 'absolute',
                    top: '18px',
                    right: 'clamp(1.25rem, 4vw, 2rem)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>

                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    marginTop: '56px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <img src="/logo.png" alt="BookMyPitch" style={{ height: '48px', width: 'auto', display: 'block' }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '18px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: 'var(--text)',
                      lineHeight: 1,
                    }}
                  >
                    Book<span style={{ color: '#C6F135' }}>My</span>Pitch
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.75, fontSize: '0.72em', fontWeight: 600, marginLeft: '1px' }}>
                      .uk
                    </span>
                  </span>
                </Link>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
                  {NAV_LINKS.map(link => {
                    const isActive = link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href)
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        style={{ textDecoration: 'none' }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '10px 28px',
                            borderRadius: 'var(--radius-full)',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: '22px',
                            letterSpacing: '-0.01em',
                            color: isActive ? 'var(--green)' : 'var(--text-secondary)',
                            background: isActive ? 'var(--green-faint)' : 'transparent',
                          }}
                        >
                          {link.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  {SOCIALS.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      aria-label={s.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        {s.icon}
                      </svg>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    fontWeight: 500,
                    marginBottom: '28px',
                    textAlign: 'center',
                  }}
                >
                  All Rights Reserved — © {new Date().getFullYear()} BookMyPitch
                </div>
              </div>
            )}
          </div>
          {user ? (
            <>
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => { setDropdownOpen(false); setNotifOpen(o => !o) }}
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '1px',
                        right: '1px',
                        minWidth: '15px',
                        height: '15px',
                        padding: '0 3px',
                        borderRadius: '999px',
                        background: '#FF4444',
                        color: '#fff',
                        fontSize: '9px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1,
                        border: '2px solid rgba(8,8,8,0.96)',
                      }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '16px',
                      padding: '6px',
                      width: '300px',
                      maxHeight: '360px',
                      overflowY: 'auto',
                      zIndex: 400,
                      boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Notifications
                    </div>
                    {notifications.length === 0 ? (
                      <div
                        style={{
                          padding: '20px 10px',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center',
                          fontWeight: 500,
                        }}
                      >
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className="dropdown-item"
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            marginBottom: '2px',
                            background: n.read ? 'transparent' : 'rgba(198,241,53,0.06)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '13px',
                              color: 'var(--text)',
                              fontWeight: n.read ? 500 : 700,
                              lineHeight: 1.4,
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {n.message}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              marginTop: '4px',
                              fontWeight: 500,
                            }}
                          >
                            {formatNotifTime(n.created_at)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                className="profile-btn"
                onClick={() => { setNotifOpen(false); setDropdownOpen(o => !o) }}
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
                <span className="profile-name" style={{ letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>
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
            </>
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
                  padding: '0.5rem 0.75rem',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Sign in
              </Link>
              <Link href="/auth/signup" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm" style={{ borderRadius: 'var(--radius-full)' }}>
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
    </nav>
  )
}
