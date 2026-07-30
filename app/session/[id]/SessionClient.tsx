'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PhoneInput, { parsePhone } from '@/components/PhoneInput'
import { readPlayerDetails, readMySessions, readSessionPlayer, removeSessionPlayer, removeMySession } from '@/lib/clientStorage'
import { Footer } from '@/components/Footer'
import { getSlotType, formatSlotType, Pitch } from '@/lib/slots'
import { Badge } from '@/components/ui/Badge'

interface Player {
  id: string
  name: string
  joined_at: string
  session_id: string
  user_id?: string | null
}

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string | null
  sender_name: string | null
}

interface Session {
  id: string
  status: string
  created_at: string
  organiser_name: string | null
  organiser_phone: string | null
  organiser_id?: string | null
  game_type: string | null
  is_public: boolean
  slots: {
    id: string
    date: string
    start_time: string
    end_time: string
    price: number
    max_players: number
    pitches: Pitch
    venues: { id: string; name: string; address: string }
  }
  players: Player[]
}

interface Props {
  session: Session
  hasRival: boolean
  initialMessages: Message[]
  justJoined: boolean
  justCreated: boolean
  alreadyIn: boolean
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function sliceTime(t: string): string {
  return t ? t.slice(0, 5) : t
}

function SegBar({ count, isConfirmed, max = 10 }: { count: number; isConfirmed: boolean; max?: number }) {
  const isAmber = count >= Math.ceil(max * 0.7) && count < max
  const segClass = isConfirmed ? 'lit-green' : isAmber ? 'lit-amber' : 'lit-green'
  return (
    <div className="seg-bar" style={{ margin: '16px 0 12px', width: '100%', boxSizing: 'border-box' }}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`seg-bar-seg ${i < count ? segClass : 'unlit'}`}
          style={{ transitionDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  )
}

export default function SessionClient({
  session: initialSession,
  hasRival,
  initialMessages,
  justJoined,
  justCreated,
  alreadyIn,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  const [newMsg, setNewMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [shareUrl, setShareUrl] = useState(`/session/${session.id}`)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [lookupOpen, setLookupOpen] = useState(false)
  const [lookupPhone, setLookupPhone] = useState('+44')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [foundPlayer, setFoundPlayer] = useState<Player | null>(null)
  const [lookupDone, setLookupDone] = useState(false)
  const [myPlayer, setMyPlayer] = useState<{ id: string; name: string } | null>(null)
  const [myPhone, setMyPhone] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [localAlreadyIn, setLocalAlreadyIn] = useState(alreadyIn)
  const [convertOpen, setConvertOpen] = useState<'open' | null>(null)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [didOrganiserCancel, setDidOrganiserCancel] = useState(false)
  const [showRegisterPopup, setShowRegisterPopup] = useState(false)
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)
  const [returningPlayer, setReturningPlayer] = useState<Player | null>(null)
  const [returningPlayerChecked, setReturningPlayerChecked] = useState(false)
  const [bannerLeaveOpen, setBannerLeaveOpen] = useState(false)
  const [bannerLeaveLoading, setBannerLeaveLoading] = useState(false)
  const [bannerLeaveError, setBannerLeaveError] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinPhone, setJoinPhone] = useState('+44')
  const [joinNameError, setJoinNameError] = useState('')
  const [joinPhoneError, setJoinPhoneError] = useState('')
  const joinAutofillDone = useRef(false)

  useEffect(() => {
    setShareUrl(`${window.location.origin}/session/${session.id}`)
  }, [session.id])

  const slot = session.slots
  const isConfirmed = session.status === 'confirmed'
  const isFilling = session.status === 'filling'
  const isCancelled = session.status === 'cancelled'
  const isExpired = session.status === 'expired'

  const allPlayers: Player[] = session.players.filter(p => p.session_id === session.id)
  const playerCount = allPlayers.length
  const maxPlayers = slot.pitches.max_players
  const remaining = maxPlayers - playerCount
  const isFull = isFilling && playerCount >= maxPlayers
  const urgencySpotsLeft = maxPlayers - playerCount
  const showJoinUrgency = isFilling && !isFull && urgencySpotsLeft > 0 && urgencySpotsLeft <= 2
  const returningPlayerIndex = returningPlayer ? allPlayers.findIndex(p => p.id === returningPlayer.id) : -1
  const returningPlayerJerseyNumber = returningPlayerIndex >= 0 ? returningPlayerIndex + 1 : null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function refetchSession() {
      Promise.all([
        // organiser_phone is intentionally NOT selected here — it's server-side-only
        // PII fetched once by the SSR page and passed down as a prop. Re-fetching it
        // from the browser client would require exposing it via an anon/authenticated
        // grant, which leaks it to anyone viewing the session. We preserve the
        // existing value from state below instead of overwriting it from this query.
        supabase
          .from('sessions')
          .select(`
            id, status, created_at, organiser_name, organiser_id, game_type, is_public,
            slots(id, date, start_time, end_time, price, max_players, pitches(id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price),
              venues(id, name, address)
            )
          `)
          .eq('id', session.id)
          .single(),
        supabase
          .from('players')
          .select('id, name, joined_at, session_id, user_id')
          .eq('session_id', session.id)
          .order('joined_at', { ascending: true }),
      ]).then(([{ data }, { data: rawPlayers }]) => {
        if (!data) return
        const rawSlots = (data as unknown as { slots: unknown }).slots
        const s = Array.isArray(rawSlots) ? rawSlots[0] : rawSlots
        const rawVenues = (s as { venues: unknown })?.venues
        const v = Array.isArray(rawVenues) ? rawVenues[0] : rawVenues
        setSession(prev => ({
          ...(data as unknown as Session),
          organiser_phone: prev.organiser_phone,
          slots: { ...(s as Session['slots']), venues: v as Session['slots']['venues'] },
          players: ((rawPlayers ?? []) as Player[]).filter(p => p.session_id === session.id),
        }))
      })
    }

    const channel = supabase
      .channel(`session-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` }, refetchSession)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` }, refetchSession)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${session.id}` }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session.id])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
      setCurrentUserId(user?.id ?? null)

      // Returning guest: check session-specific localStorage entry and validate phone via DB
      if (!user) {
        try {
          const storedPlayer = readSessionPlayer(initialSession.id)
          const storedPhone = storedPlayer?.phone
          if (storedPhone) {
            const { data: rp } = await supabase
              .from('players')
              .select('id, name, joined_at, session_id, user_id')
              .eq('session_id', initialSession.id)
              .eq('phone', storedPhone)
              .maybeSingle()
            if (rp) {
              const p = rp as Player
              setReturningPlayer(p)
              setMyPlayer({ id: p.id, name: p.name })
              setMyPhone(storedPhone)
              setLocalAlreadyIn(true)
            }
          }
        } catch {}
        setReturningPlayerChecked(true)
      }

      // Guest: check localStorage for a prior join to this session
      try {
        const sessions = readMySessions()
        const entry = sessions.find(b => b.sessionId === initialSession.id)
        if (entry?.name) {
          const details = readPlayerDetails()
          const phone = details?.phone ?? null
          setMyPhone(phone)
          const matched = initialSession.players.find(
            (p: Player) => p.name.toLowerCase() === entry.name.toLowerCase()
          )
          if (matched) {
            setMyPlayer({ id: matched.id, name: matched.name })
            if (user?.id !== initialSession.organiser_id) {
              setLocalAlreadyIn(true)
            }
          } else if (initialSession.organiser_name?.toLowerCase() === entry.name.toLowerCase()) {
            setMyPlayer({ id: 'organiser', name: entry.name })
          }
        }
      } catch {}

      // Logged-in: detect membership by user_id (primary), fall back to name for organiser
      if (user) {
        const matchedById = initialSession.players.find(
          (p: Player) => p.user_id === user.id
        )
        if (matchedById) {
          setMyPlayer({ id: matchedById.id, name: matchedById.name })
          if (user.id !== initialSession.organiser_id) {
            setLocalAlreadyIn(true)
          }
        } else {
          const userName: string = user.user_metadata?.name ?? ''
          if (userName) {
            if (initialSession.organiser_name?.toLowerCase() === userName.toLowerCase()) {
              setMyPlayer({ id: 'organiser', name: userName })
            }
          }
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUserId(null)
        setIsLoggedIn(false)
        setLocalAlreadyIn(false)
        setMyPlayer(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!justJoined || isLoggedIn !== false) return
    if (session.game_type === 'open') return
    if (isConfirmed) return
    if (sessionStorage.getItem('bmp_join_popup_dismissed')) return
    setShowRegisterPopup(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  async function handleConvertToOpen() {
    setConverting(true)
    setConvertError('')
    const { error } = await supabase
      .from('sessions')
      .update({ game_type: 'open', is_public: true })
      .eq('id', session.id)
    if (error) {
      setConvertError('Failed to update. Please try again.')
      setConverting(false)
      return
    }
    setSession(prev => ({ ...prev, game_type: 'open', is_public: true }))
    setConvertOpen(null)
    setConverting(false)
  }

  async function handleCancelSession() {
    setCancelLoading(true)
    setCancelError('')
    try {
      const res = await fetch('/api/cancel-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCancelError(json.error ?? 'Something went wrong')
        setCancelLoading(false)
        return
      }
      router.push('/slots')
    } catch {
      setCancelError('Something went wrong. Please try again.')
      setCancelLoading(false)
    }
  }

  function dismissRegisterPopup() {
    sessionStorage.setItem('bmp_join_popup_dismissed', 'true')
    setShowRegisterPopup(false)
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRegLoading(true)
    setRegError('')
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
      })
      if (error) {
        const msg = error.message
        const alreadyExists = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')
        setRegError(alreadyExists ? 'already_registered' : msg)
        setRegLoading(false)
        return
      }
      const userId = data.user?.id
      if (userId && myPlayer?.id && myPlayer.id !== 'organiser' && myPhone) {
        await fetch('/api/link-player-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: myPlayer.id, userId, phone: myPhone }),
        })
      }
      setRegSuccess(true)
      setRegLoading(false)
    } catch {
      setRegError('Something went wrong. Please try again.')
      setRegLoading(false)
    }
  }

  function toggleLookup() {
    setLookupOpen(o => {
      if (o) { setLookupDone(false); setFoundPlayer(null); setLookupPhone('+44') }
      return !o
    })
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!parsePhone(lookupPhone).localNumber.trim()) return
    const phone = lookupPhone.trim()
    setLookupLoading(true)
    const { data } = await supabase
      .from('players')
      .select('id, name, joined_at, session_id')
      .eq('session_id', session.id)
      .eq('phone', phone)
      .maybeSingle()
    const player = data as Player | null
    setFoundPlayer(player)
    if (player) {
      setMyPlayer({ id: player.id, name: player.name })
      setMyPhone(phone)
    }
    setLookupDone(true)
    setLookupLoading(false)
  }

  async function handleLeave() {
    if (!myPlayer) return
    setLeaveLoading(true)
    setLeaveError('')
    try {
      // Always route through the API so Stripe payment method detach is guaranteed.
      // Authenticated users send sessionId only (API uses auth cookie to find player).
      // Guests send their phone number so the API can look them up.
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, phone: currentUserId ? undefined : myPhone }),
      })
      const json = await res.json()
      if (!res.ok) {
        setLeaveError(json.error ?? 'Something went wrong')
        setLeaveLoading(false)
        return
      }
      try {
        removeMySession(session.id)
      } catch {}
      router.push('/slots')
    } catch {
      setLeaveError('Something went wrong. Please try again.')
      setLeaveLoading(false)
    }
  }

  async function handleOrganiserLeave() {
    if (!myPlayer || myPlayer.id === 'organiser') return
    setLeaveLoading(true)
    setLeaveError('')
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setLeaveError(json.error ?? 'Something went wrong')
        setLeaveLoading(false)
        return
      }
      // Stay on the page — become a regular visitor who can rejoin
      setMyPlayer(null)
      setLocalAlreadyIn(false)
      setLeaveOpen(false)
      setSession(prev => ({ ...prev, organiser_id: null, organiser_name: null, organiser_phone: null }))
      try {
        removeMySession(session.id)
      } catch {}
    } catch {
      setLeaveError('Something went wrong. Please try again.')
      setLeaveLoading(false)
    }
  }

  async function handleBannerLeave() {
    setBannerLeaveLoading(true)
    setBannerLeaveError('')
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, phone: myPhone }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBannerLeaveError(json.error ?? 'Something went wrong')
        setBannerLeaveLoading(false)
        return
      }
      try {
        removeSessionPlayer(session.id)
        removeMySession(session.id)
      } catch {}
      setReturningPlayer(null)
      setMyPlayer(null)
      setMyPhone(null)
      setLocalAlreadyIn(false)
      setBannerLeaveOpen(false)
      setBannerLeaveLoading(false)
    } catch {
      setBannerLeaveError('Something went wrong. Please try again.')
      setBannerLeaveLoading(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  useEffect(() => {
    if (joinAutofillDone.current) return
    joinAutofillDone.current = true
    async function autofill() {
      try {
        const ss = sessionStorage.getItem('join_details')
        if (ss) {
          const { name: n, phone: p } = JSON.parse(ss)
          if (n) setJoinName(n)
          if (p) setJoinPhone(p)
          return
        }
      } catch { /* ignore */ }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata as Record<string, unknown>
        if (typeof meta?.name === 'string') setJoinName(meta.name)
        if (typeof meta?.phone === 'string') {
          setJoinPhone(meta.phone)
        } else {
          // phone isn't selectable by the browser client, so this goes through an API route
          const { phone: sp } = await fetch('/api/latest-phone').then(r => r.json())
          if (sp) setJoinPhone(sp)
        }
        return
      }
      try {
        const details = readPlayerDetails()
        if (details?.name) setJoinName(details.name)
        if (details?.phone) setJoinPhone(details.phone)
      } catch { /* ignore */ }
    }
    autofill()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleJoinFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    let valid = true
    if (!joinName.trim() || !/^[A-Za-z ]+$/.test(joinName.trim())) {
      setJoinNameError('Please enter a valid name')
      valid = false
    } else {
      setJoinNameError('')
    }
    const joinLocalNumber = parsePhone(joinPhone).localNumber
    if (!joinLocalNumber.trim() || !/^[0-9]{1,15}$/.test(joinLocalNumber.trim())) {
      setJoinPhoneError('Please enter a valid phone number')
      valid = false
    } else {
      setJoinPhoneError('')
    }
    if (!valid) return
    sessionStorage.setItem('join_details', JSON.stringify({ name: joinName.trim(), phone: joinPhone.trim() }))
    router.push(`/session/${session.id}/payment`)
  }

  function shareWhatsApp() {
    const venueName = slot.venues?.name ?? 'your local pitch'
    const text = `Join my ${slot.pitches.format} at ${venueName} — ${sliceTime(slot.start_time)}–${sliceTime(slot.end_time)} on ${formatDate(slot.date)}!\n${shareUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || sendingMsg) return
    setSendingMsg(true)
    // Eligibility (auth user_id or guest phone matching a player row in this
    // session) is verified server-side in /api/send-message using the service
    // role client — phone numbers never touch the messages table or the
    // browser-readable RLS path.
    const phone = currentUserId
      ? undefined
      : (readSessionPlayer(session.id)?.phone ?? readPlayerDetails()?.phone ?? undefined)
    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, content: newMsg.trim(), phone }),
      })
      if (res.ok) setNewMsg('')
    } finally {
      setSendingMsg(false)
    }
  }

  const perPlayerPounds = (slot.price / slot.pitches.max_players + 0.50 + 0.30).toFixed(2)
  const isOrganiserUser = !!(currentUserId && session.organiser_id && currentUserId === session.organiser_id)
  const isMyPlayerOrganiser = isOrganiserUser || !!(myPlayer && session.organiser_name && myPlayer.name.toLowerCase() === session.organiser_name.toLowerCase())
  // Organiser may leave private/open sessions — they need a real player row (id !== 'organiser')
  const isLeaveableGameType = session.game_type === 'private' || session.game_type === 'open'
  const canOrganiserLeave = isOrganiserUser && isLeaveableGameType && !!myPlayer && myPlayer.id !== 'organiser'
  const showLeaveButton = isFilling && !!myPlayer && myPlayer.id !== 'organiser' && (!isMyPlayerOrganiser || canOrganiserLeave)

  function renderPlayerToken(i: number) {
    const player = allPlayers[i]
    const isOrganiserToken = !!(player && (
      (session.organiser_id && player.user_id === session.organiser_id) ||
      (!session.organiser_id && session.organiser_name && player.name.toLowerCase() === session.organiser_name.toLowerCase())
    ))
    const parts = player ? player.name.trim().split(/\s+/) : []
    const firstInitial = parts[0]?.[0]?.toUpperCase() ?? ''
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : ''
    const initials = (firstInitial + lastInitial) || '?'
    const firstName = parts[0] ?? ''

    return (
      <div
        key={i}
        title={player ? `${player.name}${isOrganiserToken ? ' (Organiser)' : ''}` : `Spot ${i + 1}`}
        className={`player-token ${player ? 'filled' : ''}`}
        style={{
          position: 'relative',
          flex: 1,
          height: '60px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          background: player ? 'rgba(198,241,53,0.09)' : 'rgba(255,255,255,0.02)',
          border: player ? '1px solid rgba(198,241,53,0.28)' : '1px dashed rgba(255,255,255,0.07)',
          boxShadow: player ? '0 0 20px rgba(198,241,53,0.08)' : 'none',
          animationDelay: `${i * 40}ms`,
          transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '5px',
            fontSize: '7px',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: player ? 'rgba(198,241,53,0.4)' : 'rgba(255,255,255,0.06)',
            lineHeight: 1,
          }}
        >
          {i + 1}
        </div>

        {isOrganiserToken && (
          <div
            style={{
              position: 'absolute',
              top: '3px',
              left: '4px',
              fontSize: '8px',
              color: 'rgba(198,241,53,0.8)',
              lineHeight: 1,
            }}
          >
            ♛
          </div>
        )}

        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: player ? 'var(--green)' : 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 700,
            color: player ? 'var(--black)' : 'transparent',
            flexShrink: 0,
            fontFamily: 'var(--font-display)',
          }}
        >
          {player ? initials : ''}
        </div>

        {player && (
          <div
            style={{
              fontSize: '7px',
              fontWeight: 700,
              color: 'var(--text)',
              textAlign: 'center',
              lineHeight: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              padding: '0 4px',
              opacity: 0.85,
            }}
          >
            {firstName}
          </div>
        )}
      </div>
    )
  }


  if (isCancelled || isExpired) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        <div
          style={{
            background: 'rgba(255,68,68,0.05)',
            border: '1px solid rgba(255,68,68,0.18)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            marginTop: '1rem',
          }}
        >
          <div style={{ fontSize: '38px', marginBottom: '1.25rem' }}>✕</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              letterSpacing: '-0.04em',
              marginBottom: '0.75rem',
              lineHeight: 1.1,
              color: 'var(--text)',
            }}
          >
            {isExpired ? "This game's time has passed" : 'This game was cancelled'}
          </div>
          <div
            style={{
              fontSize: '15px',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              marginBottom: '2rem',
              fontWeight: 500,
            }}
          >
            {isExpired ? "Not enough players joined in time, so it never confirmed. No one was charged." : 'No charge was made.'}
          </div>
          <Link href="/slots" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: 'var(--green)',
                color: 'var(--black)',
                border: 'none',
                padding: '1rem 2rem',
                minHeight: '52px',
                borderRadius: 'var(--radius-lg)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              Find another game time →
            </button>
          </Link>
        </div>
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link
            href="/slots"
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            ← Browse all game times
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

      {/* ============================================================
          CONFIRMED BANNER
          ============================================================ */}
      {isConfirmed && (
        <div
          className="anim-fade-up"
          style={{
            background: 'var(--green)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              color: 'var(--black)',
              letterSpacing: '-0.025em',
              lineHeight: 1.35,
              marginBottom: '5px',
            }}
          >
            ✓ Game Confirmed — {formatDate(slot.date)} · {sliceTime(slot.start_time)} · {slot.venues?.name ?? 'your local pitch'}
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>
            £{perPlayerPounds} was charged to your card
          </div>
        </div>
      )}

      {/* Alert banners */}
      {localAlreadyIn && !justJoined && !justCreated && !returningPlayer && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.22)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.2rem',
            marginBottom: '1.25rem',
            fontSize: '15px',
            color: 'var(--green)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✓
          </span>
          You&apos;re already in this game!
        </div>
      )}

      {justCreated && isFilling && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(198,241,53,0.07) 0%, rgba(198,241,53,0.03) 100%)',
            border: '1px solid rgba(198,241,53,0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.15rem 1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              color: 'var(--green)',
              marginBottom: '5px',
              letterSpacing: '-0.025em',
            }}
          >
            Game created!
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>
            Share the link below with your mates. When {maxPlayers} players join, everyone pays automatically.
          </div>
        </div>
      )}

      {justJoined && isFilling && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.2rem',
            marginBottom: '1.25rem',
            fontSize: '15px',
            color: 'var(--green)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✓
          </span>
          You&apos;re in! Share the link to fill the remaining spots.
        </div>
      )}

      {/* ============================================================
          RETURNING PLAYER PERSONALISED BANNER
          ============================================================ */}
      {returningPlayer && isLoggedIn === false && !justJoined && !justCreated && isFilling && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.2rem',
            marginBottom: '1.25rem',
          }}
        >
          {!bannerLeaveOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '14px', color: 'var(--green)', fontWeight: 700, lineHeight: 1.5 }}>
                <span style={{ marginRight: '6px', fontSize: '16px' }}>⚽</span>
                You&apos;re in this game · Spot {returningPlayerJerseyNumber ?? '—'} · {remaining} more player{remaining !== 1 ? 's' : ''} needed to confirm
              </div>
              <button
                onClick={() => setBannerLeaveOpen(true)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,68,68,0.35)',
                  background: 'rgba(255,68,68,0.08)',
                  color: 'rgba(255,100,100,0.9)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                Leave game
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 700, marginBottom: '6px' }}>
                Are you sure you want to leave?
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6, marginBottom: '12px' }}>
                Your spot will be freed up for someone else. No charge has been made.
              </div>
              {bannerLeaveError && (
                <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginBottom: '10px' }}>
                  {bannerLeaveError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setBannerLeaveOpen(false); setBannerLeaveError('') }}
                  disabled={bannerLeaveLoading}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                    fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                    cursor: 'pointer', lineHeight: 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBannerLeave}
                  disabled={bannerLeaveLoading}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    background: bannerLeaveLoading ? 'rgba(255,68,68,0.3)' : 'rgba(255,68,68,0.85)',
                    color: 'var(--text)', fontFamily: 'var(--font-display)',
                    fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                    cursor: bannerLeaveLoading ? 'not-allowed' : 'pointer', lineHeight: 1,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {bannerLeaveLoading ? 'Leaving…' : 'Yes, leave'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {returningPlayer && isLoggedIn === false && !justJoined && !justCreated && isConfirmed && (
        <div
          style={{
            background: 'var(--green)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.1rem 1.3rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '15px', color: 'var(--black)', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.025em', lineHeight: 1.4 }}>
            Game confirmed ✓ · £{perPlayerPounds} was taken from your card · {formatDate(slot.date)} · {sliceTime(slot.start_time)}–{sliceTime(slot.end_time)} · {slot.venues?.name ?? 'your local pitch'}
          </div>
        </div>
      )}

      {/* ============================================================
          SESSION SUMMARY CARD
          ============================================================ */}
      <div
        className="anim-fade-up d-100"
        style={{
          background: isConfirmed ? 'rgba(198,241,53,0.04)' : 'var(--surface)',
          border: `1px solid ${isConfirmed ? 'rgba(198,241,53,0.28)' : isFilling ? 'rgba(198,241,53,0.15)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem',
          marginBottom: '1.25rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Slot info */}
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-tertiary)',
            marginBottom: '5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {slot.venues?.name ?? 'your local pitch'}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            letterSpacing: '-0.04em',
            marginBottom: '3px',
            lineHeight: 1,
          }}
        >
          {sliceTime(slot.start_time)} – {sliceTime(slot.end_time)}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
          {formatDate(slot.date)} · {formatSlotType(getSlotType(slot.date, slot.start_time))} · {slot.pitches.format}
        </div>
        {session.game_type === 'private' && (
          <div style={{ marginBottom: '0.6rem' }}>
            <Badge variant="neutral">Private</Badge>
          </div>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(slot.venues?.address ?? slot.venues?.name ?? 'football pitch London')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-block', fontSize: '12px', color: 'rgba(198,241,53,0.65)', fontWeight: 600, textDecoration: 'underline', marginBottom: '1.5rem', textUnderlineOffset: '2px' }}
        >
          Get directions →
        </a>

        {/* TEAM LINEUP */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
            {Array.from({ length: Math.ceil(maxPlayers / 2) }, (_, i) => renderPlayerToken(i))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ fontSize: '7px', fontWeight: 700, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>
              {slot.pitches.format}
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: Math.floor(maxPlayers / 2) }, (_, i) => renderPlayerToken(i + Math.ceil(maxPlayers / 2)))}
          </div>

          <SegBar count={playerCount} isConfirmed={isConfirmed} max={maxPlayers} />

          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 600 }}>
            {isConfirmed ? (
              <strong style={{ color: 'var(--green)', fontWeight: 800 }}>Confirmed — all {maxPlayers} players ✓</strong>
            ) : (
              <>
                <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{playerCount}/{maxPlayers} players</strong>
                {' '}— {remaining} more needed
              </>
            )}
          </div>
        </div>

        {session.organiser_name && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 500, marginTop: '0.6rem', opacity: 0.7 }}>
            Organiser: {session.organiser_name}{session.organiser_phone ? ` · ${session.organiser_phone}` : ''}
          </div>
        )}
      </div>

      {/* Rival alert */}
      {hasRival && isFilling && (
        <div
          style={{
            background: 'rgba(255,184,0,0.06)',
            border: '1px solid rgba(255,184,0,0.22)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.25rem',
            fontSize: '14px',
            color: 'var(--amber)',
            display: 'flex',
            gap: '8px',
            lineHeight: 1.55,
            fontWeight: 600,
            alignItems: 'center',
          }}
        >
          <span style={{ flexShrink: 0, fontSize: '16px' }}>⚡</span>
          <span>Another group is also trying to fill this game time. First to 10 gets it.</span>
        </div>
      )}

      {/* ============================================================
          CONFIRMED BOOKING DETAILS
          ============================================================ */}
      {isConfirmed && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '15px',
              letterSpacing: '-0.025em',
              marginBottom: '1rem',
            }}
          >
            Booking details
          </div>
          {[
            { label: 'Pitch', val: slot.venues?.name ?? 'your local pitch' },
            { label: 'Address', val: slot.venues?.address ?? '' },
            { label: 'Date', val: formatDate(slot.date) },
            { label: 'Time', val: `${sliceTime(slot.start_time)} – ${sliceTime(slot.end_time)}` },
            { label: 'Your cost', val: `£${perPlayerPounds}` },
            { label: 'Status', val: 'Confirmed ✓' },
          ].map((row, idx, arr) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px',
                padding: '0.6rem 0',
                borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{row.label}</span>
              <span
                style={{
                  fontWeight: 800,
                  color: row.label === 'Your cost' || row.label === 'Status' ? 'var(--green)' : 'var(--text)',
                  letterSpacing: '-0.01em',
                }}
              >
                {row.val}
              </span>
            </div>
          ))}
        </div>
      )}


      {/* Confirmed — non-member notice */}
      {isConfirmed && !localAlreadyIn && !isOrganiserUser && isLoggedIn !== null && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px', fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
            This game is already confirmed
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
            It&apos;s underway — no spots available.
          </div>
          <Link href="/slots" style={{ textDecoration: 'none' }}>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: 'var(--green)',
                color: 'var(--black)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                lineHeight: 1,
                minHeight: '44px',
              }}
            >
              Find another game time →
            </button>
          </Link>
        </div>
      )}

      {/* ============================================================
          SHARE SECTION
          ============================================================ */}
      {isFilling && (
        <>
          {playerCount < maxPlayers && (
          <div
            className="anim-fade-up d-200"
            style={{
              background: 'linear-gradient(145deg, rgba(198,241,53,0.07) 0%, rgba(198,241,53,0.03) 100%)',
              border: '1px solid rgba(198,241,53,0.28)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.5rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--text)',
                marginBottom: '5px',
              }}
            >
              Share with your team
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6, fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
              {remaining} spot{remaining !== 1 ? 's' : ''} left. Send this link to fill them.
            </div>

            {/* URL + Copy inline — hero row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div
                style={{
                  flex: 1,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '0 1rem',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {shareUrl}
              </div>
              <button
                className="share-copy"
                onClick={copyLink}
                style={{
                  padding: '0 1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  border: 'none',
                  background: copied ? 'rgba(198,241,53,0.15)' : 'var(--green)',
                  color: copied ? 'var(--green)' : 'var(--black)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '-0.015em',
                  cursor: 'pointer',
                  transition: 'background 160ms ease, color 160ms ease, transform 160ms var(--ease-out)',
                  lineHeight: 1,
                  flexShrink: 0,
                  minHeight: '48px',
                  whiteSpace: 'nowrap',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
            </div>

            {/* WhatsApp — full width */}
            <button
              className="share-wa"
              onClick={shareWhatsApp}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: '#25D366',
                color: 'var(--text)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                transition: 'background 160ms ease, transform 160ms var(--ease-out), box-shadow 160ms ease',
                lineHeight: 1,
              }}
            >
              WhatsApp →
            </button>
          </div>
          )}

          {/* ============================================================
              GAME SETTINGS — private session, organiser only
              ============================================================ */}
          {isOrganiserUser && session.game_type === 'private' && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.16em', fontFamily: 'var(--font-sans)', marginBottom: '8px' }}>
                Game settings
              </div>

              {convertOpen === 'open' ? (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: '6px' }}>
                    Make this public?
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
                    Anyone will be able to find and join this game publicly. Once public, the game can no longer be cancelled — you can still leave it yourself.
                  </div>
                  {convertError && (
                    <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginBottom: '0.75rem' }}>
                      {convertError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => { setConvertOpen(null); setConvertError('') }}
                      disabled={converting}
                      style={{
                        flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                        fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em', cursor: 'pointer', lineHeight: 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConvertToOpen}
                      disabled={converting}
                      style={{
                        flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                        border: 'none',
                        background: converting ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
                        color: converting ? 'var(--text-secondary)' : 'var(--text)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                        cursor: converting ? 'not-allowed' : 'pointer', lineHeight: 1,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {converting ? 'Saving…' : 'Yes, make public'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    className="settings-btn"
                    onClick={() => { setConvertOpen('open'); setConvertError('') }}
                    style={{
                      width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface2)',
                      color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                      fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      textAlign: 'left', lineHeight: 1,
                    }}
                  >
                    Make this public
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Urgency — spots nearly gone */}
          {showJoinUrgency && !localAlreadyIn && !isOrganiserUser && (
            <div
              className="anim-fade-up d-280"
              style={{
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--amber)',
                marginBottom: '0.5rem',
                letterSpacing: '-0.01em',
              }}
            >
              🔥 Only {urgencySpotsLeft} spot{urgencySpotsLeft !== 1 ? 's' : ''} left!
            </div>
          )}

          {/* Join CTA */}
          {!localAlreadyIn && !isOrganiserUser && (
            isFull ? (
              <div
                className="anim-fade-up d-300"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1.25rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px', fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}>
                  This game is full
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
                  All spots have been taken. Find another game time below.
                </div>
                <Link href="/slots" style={{ textDecoration: 'none' }}>
                  <button
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: 'var(--radius-lg)',
                      border: 'none',
                      background: 'var(--green)',
                      color: 'var(--black)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '14px',
                      letterSpacing: '-0.015em',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    See open games →
                  </button>
                </Link>
              </div>
            ) : isLoggedIn === false && session.game_type === 'open' ? (
              <Link
                href={`/auth/login?redirect=${encodeURIComponent(`/session/${session.id}`)}`}
                className="anim-fade-up d-300"
                style={{ textDecoration: 'none', display: 'block', marginBottom: '1.25rem' }}
              >
                <button
                  className="join-btn"
                  style={{
                    width: '100%',
                    padding: '1.25rem',
                    fontSize: '18px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  Log in to join →
                </button>
              </Link>
            ) : (
              <div id="join-form" className="anim-fade-up d-300" style={{ marginBottom: '1.25rem' }}>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.5rem',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '21px', color: 'var(--text)', letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: '6px' }}>
                    Join this game
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.1rem' }}>
                    Nothing is charged now — your card is only saved once all {maxPlayers} players join.
                  </div>
                  <form onSubmit={handleJoinFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '7px', display: 'block', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em' }}>
                        Your name
                      </label>
                      <input
                        className="field-input"
                        type="text"
                        autoComplete="name"
                        value={joinName}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^a-zA-Z0-9\s]/g, '')
                          setJoinName(cleaned)
                          if (joinNameError) setJoinNameError('')
                        }}
                        onKeyDown={(e) => {
                          if (e.ctrlKey || e.metaKey) return
                          if (['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return
                          if (!/^[a-zA-Z0-9\s]$/.test(e.key)) e.preventDefault()
                        }}
                        placeholder="Full name"
                        style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 1rem', color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, outline: 'none', transition: 'border-color 0.15s ease', boxSizing: 'border-box' as const }}
                      />
                      {joinNameError && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{joinNameError}</div>}
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '7px', display: 'block', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em' }}>
                        Phone number
                      </label>
                      <PhoneInput
                        value={joinPhone}
                        onChange={(v) => {
                          setJoinPhone(v)
                          if (joinPhoneError) setJoinPhoneError('')
                        }}
                      />
                      {joinPhoneError && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>{joinPhoneError}</div>}
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.55 }}>
                      🔒 <strong style={{ color: 'var(--text)' }}>Nothing is charged now</strong> — your card is only taken when all {maxPlayers} players join.
                    </div>

                    <button
                      type="submit"
                      disabled={!joinName.trim() || !parsePhone(joinPhone).localNumber.trim()}
                      className={joinName.trim() && parsePhone(joinPhone).localNumber.trim() ? 'btn-g' : ''}
                      style={{
                        width: '100%', padding: '1rem', fontSize: '16px', borderRadius: '12px', border: 'none',
                        cursor: !joinName.trim() || !parsePhone(joinPhone).localNumber.trim() ? 'not-allowed' : 'pointer',
                        background: !joinName.trim() || !parsePhone(joinPhone).localNumber.trim() ? 'var(--surface2)' : 'var(--green)',
                        color: !joinName.trim() || !parsePhone(joinPhone).localNumber.trim() ? 'var(--text-secondary)' : 'var(--black)',
                        fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1,
                        transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                      }}
                    >
                      Continue to payment →
                    </button>

                  </form>
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* ============================================================
          ALREADY JOINED? — guest lookup
          ============================================================ */}
      {isFilling && isLoggedIn === false && !alreadyIn && !justJoined && !justCreated && returningPlayerChecked && !returningPlayer && (
        <div className="anim-fade-up d-350" style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={toggleLookup}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.01em',
              transition: 'border-color 0.15s ease, color 0.15s ease',
              textAlign: 'center',
              lineHeight: 1,
            }}
          >
            {lookupOpen ? '↑' : '↓'} Already joined this game?
          </button>

          {lookupOpen && (
            <div
              style={{
                marginTop: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              {!lookupDone ? (
                <form onSubmit={handleLookup}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.85rem', lineHeight: 1.6 }}>
                    Joined from a different device? Enter your number to find your spot.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <PhoneInput value={lookupPhone} onChange={setLookupPhone} />
                    </div>
                    <button
                      type="submit"
                      disabled={lookupLoading || !parsePhone(lookupPhone).localNumber.trim()}
                      style={{
                        padding: '0.8rem 1.1rem',
                        borderRadius: 'var(--radius-lg)',
                        border: 'none',
                        background: lookupLoading || !parsePhone(lookupPhone).localNumber.trim() ? 'var(--surface2)' : 'var(--green)',
                        color: lookupLoading || !parsePhone(lookupPhone).localNumber.trim() ? 'var(--text-secondary)' : 'var(--black)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '13px',
                        letterSpacing: '-0.015em',
                        cursor: lookupLoading || !parsePhone(lookupPhone).localNumber.trim() ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        lineHeight: 1,
                        transition: 'background 0.15s ease, color 0.15s ease',
                      }}
                    >
                      {lookupLoading ? '…' : 'Find my spot'}
                    </button>
                  </div>
                </form>
              ) : foundPlayer ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.85rem' }}>
                    <span
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: 'var(--green)',
                        color: 'var(--black)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 700,
                        flexShrink: 0,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      ✓
                    </span>
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '16px',
                          letterSpacing: '-0.025em',
                          color: 'var(--text)',
                          lineHeight: 1.1,
                          marginBottom: '2px',
                        }}
                      >
                        You&apos;re in, {foundPlayer.name.split(' ')[0]}!
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Your spot is highlighted in the grid above.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setLookupDone(false); setFoundPlayer(null); setLookupPhone('+44') }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Check a different number
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '0.85rem' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '15px',
                        letterSpacing: '-0.025em',
                        color: 'var(--text)',
                        marginBottom: '4px',
                      }}
                    >
                      Not in this game
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6 }}>
                      That number doesn&apos;t match anyone in this game yet.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {isFilling && (
                      <button
                        className="btn-g"
                        onClick={() => document.getElementById('join-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        style={{
                          padding: '0.65rem 1.25rem',
                          borderRadius: 'var(--radius-lg)',
                          border: 'none',
                          background: 'var(--green)',
                          color: 'var(--black)',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: '13px',
                          letterSpacing: '-0.015em',
                          cursor: 'pointer',
                          lineHeight: 1,
                          transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                        }}
                      >
                        Join above ↑
                      </button>
                    )}
                    <button
                      onClick={() => { setLookupDone(false); setLookupPhone('+44') }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          LEAVE + CANCEL — side by side, organiser controls
          ============================================================ */}
      {(showLeaveButton || (isOrganiserUser && isFilling && session.game_type === 'private')) && !leaveOpen && !cancelOpen && (
        <div className="anim-fade-up d-400" style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
          {showLeaveButton && (
            <button
              className="leave-btn"
              onClick={() => setLeaveOpen(true)}
              style={{
                flex: 1,
                padding: '0.65rem 0.75rem',
                background: 'transparent',
                border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: 'var(--radius-lg)',
                color: 'rgba(255,100,100,0.8)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.01em',
                transition: 'border-color 0.15s ease, color 0.15s ease',
                lineHeight: 1,
              }}
            >
              Leave game
            </button>
          )}
          {isOrganiserUser && isFilling && session.game_type === 'private' && (
            <button
              className="cancel-btn"
              onClick={() => setCancelOpen(true)}
              style={{
                flex: 1,
                padding: '0.65rem 0.75rem',
                background: 'transparent',
                border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: 'var(--radius-lg)',
                color: 'rgba(255,100,100,0.8)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.01em',
                transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
                lineHeight: 1,
              }}
            >
              Cancel game
            </button>
          )}
        </div>
      )}

      {showLeaveButton && leaveOpen && (
        <div className="anim-fade-up d-400" style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              background: 'rgba(255,68,68,0.05)',
              border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '15px',
                letterSpacing: '-0.025em',
                color: 'var(--text)',
                marginBottom: '6px',
              }}
            >
              Are you sure you want to leave?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
              {canOrganiserLeave
                ? "The game will continue without you and someone else can take your spot."
                : "Your spot will be gone and you won't be charged. This can't be undone."}
            </div>
            {leaveError && (
              <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginBottom: '0.75rem' }}>
                {leaveError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setLeaveOpen(false); setLeaveError('') }}
                disabled={leaveLoading}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '-0.015em',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={canOrganiserLeave ? handleOrganiserLeave : handleLeave}
                disabled={leaveLoading}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  borderRadius: 'var(--radius-lg)',
                  border: 'none',
                  background: leaveLoading ? 'rgba(255,68,68,0.3)' : 'rgba(255,68,68,0.85)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '-0.015em',
                  cursor: leaveLoading ? 'not-allowed' : 'pointer',
                  lineHeight: 1,
                  transition: 'background 0.15s ease',
                }}
              >
                {leaveLoading ? 'Leaving…' : 'Yes, leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          CANCEL GAME — organiser only, filling sessions
          ============================================================ */}
      {isOrganiserUser && isFilling && session.game_type === 'private' && cancelOpen && (
        <div className="anim-fade-up d-450" style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              background: 'rgba(255,68,68,0.05)',
              border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: '6px' }}>
              Are you sure you want to cancel this game?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
              All players will lose their spot and the game time will open back up. No one will be charged.
            </div>
            {cancelError && (
              <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginBottom: '0.75rem' }}>
                {cancelError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setCancelOpen(false); setCancelError('') }}
                disabled={cancelLoading}
                style={{
                  flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                  cursor: 'pointer', lineHeight: 1,
                }}
              >
                Keep it
              </button>
              <button
                onClick={handleCancelSession}
                disabled={cancelLoading}
                style={{
                  flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                  border: 'none',
                  background: cancelLoading ? 'rgba(255,68,68,0.3)' : 'rgba(255,68,68,0.85)',
                  color: 'var(--text)', fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                  cursor: cancelLoading ? 'not-allowed' : 'pointer', lineHeight: 1,
                  transition: 'background 0.15s ease',
                }}
              >
                {cancelLoading ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          SESSION CHAT — confirmed only
          ============================================================ */}
      {isConfirmed && (
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              letterSpacing: '-0.03em',
              marginBottom: '1rem',
            }}
          >
            Game chat
          </div>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-xl)',
              padding: '1rem',
              minHeight: '180px',
              maxHeight: '340px',
              overflowY: 'auto',
              marginBottom: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  padding: '2rem',
                  margin: 'auto',
                  fontWeight: 500,
                }}
              >
                No messages yet. Say something!
              </div>
            ) : (() => {
              const playerNameMap = new Map<string, string>()
              allPlayers.forEach(p => {
                if (p.user_id) playerNameMap.set(p.user_id, p.name)
              })
              return messages.map(msg => {
                const isOwn = !!currentUserId && msg.user_id === currentUserId
                const senderName = msg.sender_name
                  ?? (msg.user_id ? (playerNameMap.get(msg.user_id) ?? 'Player') : 'Guest')
                const time = new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 500 }}>
                      {senderName}
                    </div>
                    <div
                      style={{
                        maxWidth: '82%',
                        padding: '0.55rem 0.85rem',
                        borderRadius: isOwn ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                        background: isOwn ? 'var(--green)' : 'rgba(255,255,255,0.07)',
                        color: isOwn ? 'var(--black)' : 'var(--text)',
                        fontSize: '14px',
                        fontWeight: 600,
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {time}
                    </div>
                  </div>
                )
              })
            })()}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input
              className="msg-input"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder="Say something..."
              style={{
                flex: 1,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.75rem 1rem',
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '14px',
                minHeight: '44px',
                transition: 'border-color 160ms ease',
              }}
            />
            <button
              className="send-btn"
              type="submit"
              disabled={sendingMsg || !newMsg.trim()}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: 'var(--green)',
                color: 'var(--black)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                minHeight: '44px',
                transition: 'background 160ms ease, transform 120ms ease',
                lineHeight: 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link
          href="/slots"
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'color 0.15s ease',
            letterSpacing: '-0.01em',
          }}
        >
          ← Browse all game times
        </Link>
      </div>


      {/* ============================================================
          POST-JOIN REGISTRATION POPUP — non-logged-in players only
          ============================================================ */}
      {showRegisterPopup && (
        <div
          onClick={regSuccess ? undefined : dismissRegisterPopup}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              width: '100%',
              maxWidth: '400px',
            }}
          >
            {regSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(198,241,53,0.12)',
                    border: '2px solid rgba(198,241,53,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    margin: '0 auto 1.25rem',
                    color: 'var(--green)',
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    letterSpacing: '-0.04em',
                    marginBottom: '0.5rem',
                    lineHeight: 1.1,
                  }}
                >
                  Account created!
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    fontWeight: 500,
                    marginBottom: '1.5rem',
                  }}
                >
                  We&apos;ll let you know the moment all {maxPlayers} spots fill. Check your email to verify your account.
                </div>
                <button
                  onClick={() => setShowRegisterPopup(false)}
                  className="btn-g"
                  style={{
                    width: '100%',
                    minHeight: '52px',
                    fontSize: '15px',
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                    lineHeight: 1,
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    letterSpacing: '-0.04em',
                    marginBottom: '0.5rem',
                    lineHeight: 1.1,
                  }}
                >
                  Want to know when your game confirms?
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    fontWeight: 500,
                    marginBottom: '1.5rem',
                  }}
                >
                  Create a free account and we&apos;ll notify you the moment all {maxPlayers} spots fill.
                </div>
                <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        display: 'block',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: '8px',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={{
                        width: '100%',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '0.875rem 1rem',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '15px',
                        fontWeight: 500,
                        outline: 'none',
                        minHeight: '48px',
                        boxSizing: 'border-box',
                        transition: 'border-color 160ms ease',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        display: 'block',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: '8px',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      minLength={8}
                      style={{
                        width: '100%',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '0.875rem 1rem',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '15px',
                        fontWeight: 500,
                        outline: 'none',
                        minHeight: '48px',
                        boxSizing: 'border-box',
                        transition: 'border-color 160ms ease',
                      }}
                    />
                  </div>
                  {regError && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--red)',
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      {regError === 'already_registered' ? (
                        <>This email is already registered — <Link href="/auth/login" style={{ color: 'var(--red)', textDecoration: 'underline' }}>try logging in instead</Link>.</>
                      ) : regError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={regLoading}
                    className={!regLoading ? 'btn-g' : ''}
                    style={{
                      width: '100%',
                      minHeight: '52px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-lg)',
                      border: 'none',
                      cursor: regLoading ? 'not-allowed' : 'pointer',
                      background: regLoading ? 'var(--surface2)' : 'var(--green)',
                      color: regLoading ? 'var(--text-secondary)' : 'var(--black)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      letterSpacing: '-0.015em',
                      lineHeight: 1,
                      opacity: regLoading ? 0.5 : 1,
                      transition: 'background 160ms ease, color 160ms ease, transform 160ms var(--ease-out), box-shadow 160ms ease',
                    }}
                  >
                    {regLoading ? 'Creating account…' : 'Create account'}
                  </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button
                    onClick={dismissRegisterPopup}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '-0.01em',
                      padding: 0,
                      textDecoration: 'underline',
                      textDecorationColor: 'rgba(255,255,255,0.15)',
                    }}
                  >
                    No thanks, I&apos;ll use my booking link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    <Footer />
    </>
  )
}
