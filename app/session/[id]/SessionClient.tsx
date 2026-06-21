'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const COUNTRY_CODES = [
  { code: '+44',  label: '🇬🇧 +44' },
  { code: '+1',   label: '🇺🇸 +1' },
  { code: '+92',  label: '🇵🇰 +92' },
  { code: '+880', label: '🇧🇩 +880' },
  { code: '+91',  label: '🇮🇳 +91' },
  { code: '+234', label: '🇳🇬 +234' },
  { code: '+249', label: '🇸🇴 +249' },
  { code: '+212', label: '🇲🇦 +212' },
  { code: '+213', label: '🇩🇿 +213' },
  { code: '+90',  label: '🇹🇷 +90' },
]

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
}

interface Session {
  id: string
  status: string
  created_at: string
  organiser_name: string | null
  organiser_phone: string | null
  organiser_id?: string | null
  team_name: string | null
  game_type: string | null
  matched_session_id: string | null
  is_public: boolean
  slots: {
    id: string
    date: string
    start_time: string
    end_time: string
    type: string
    price: number
    max_players: number
    venues: { id: string; name: string; address: string }
  }
  players: Player[]
}

interface MatchedSession {
  id: string
  team_name: string | null
  status: string
  players: { count: number }[]
}

interface Props {
  session: Session
  hasRival: boolean
  initialMessages: Message[]
  justJoined: boolean
  justCreated: boolean
  alreadyIn: boolean
  matchedSession: MatchedSession | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function sliceTime(t: string): string {
  return t ? t.slice(0, 5) : t
}

function SegBar({ count, isConfirmed }: { count: number; isConfirmed: boolean }) {
  const isAmber = count >= 7 && count < 10
  const segClass = isConfirmed ? 'lit-green' : isAmber ? 'lit-amber' : 'lit-green'
  return (
    <div className="seg-bar" style={{ marginBottom: '10px' }}>
      {Array.from({ length: 10 }, (_, i) => (
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
  matchedSession,
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
  const [lookupPhone, setLookupPhone] = useState('')
  const [lookupCountryCode, setLookupCountryCode] = useState('+44')
  const [lookupLocalNumber, setLookupLocalNumber] = useState('')
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
  const [isPublicLocal, setIsPublicLocal] = useState(initialSession.is_public ?? false)
  const [teamNameLocal, setTeamNameLocal] = useState(initialSession.team_name ?? '')
  const [teamNameSaved, setTeamNameSaved] = useState(false)
  const teamNameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [matchedPlayers, setMatchedPlayers] = useState<Player[]>([])
  const [confirmPublicOff, setConfirmPublicOff] = useState(false)

  useEffect(() => {
    return () => { if (teamNameDebounceRef.current) clearTimeout(teamNameDebounceRef.current) }
  }, [])

  useEffect(() => {
    setShareUrl(`${window.location.origin}/session/${session.id}`)
  }, [session.id])

  const slot = session.slots
  const isConfirmed = session.status === 'confirmed'
  const isFilling = session.status === 'filling'
  const isCancelled = session.status === 'cancelled'

  const allPlayers: Player[] = session.players.filter(p => p.session_id === session.id)
  const playerCount = allPlayers.length
  const remaining = 10 - playerCount

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function refetchSession() {
      Promise.all([
        supabase
          .from('sessions')
          .select(`
            id, status, created_at, organiser_name, organiser_phone, organiser_id,
            slots(id, date, start_time, end_time, type, price, max_players,
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
        setSession({
          ...(data as unknown as Session),
          slots: { ...(s as Session['slots']), venues: v as Session['slots']['venues'] },
          players: ((rawPlayers ?? []) as Player[]).filter(p => p.session_id === session.id),
        })
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

      // Guest: check localStorage for a prior join to this session
      try {
        const sessions = JSON.parse(localStorage.getItem('bmp_my_sessions') ?? '[]')
        const entry = Array.isArray(sessions)
          ? sessions.find((b: { sessionId: string }) => b.sessionId === initialSession.id)
          : null
        if (entry?.name) {
          const details = JSON.parse(localStorage.getItem('bmp_player_details') ?? 'null')
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
    if (!matchedSession) return
    supabase
      .from('players')
      .select('id, name, joined_at, session_id, user_id')
      .eq('session_id', matchedSession.id)
      .order('joined_at', { ascending: true })
      .then(({ data }) => { if (data) setMatchedPlayers(data as Player[]) })
  }, [matchedSession?.id])

  async function handlePublicToggle() {
    if (isPublicLocal) {
      setConfirmPublicOff(true)
    } else {
      setIsPublicLocal(true)
      await supabase.from('sessions').update({ is_public: true }).eq('id', session.id)
    }
  }

  async function handleConfirmPublicOff() {
    setConfirmPublicOff(false)
    setIsPublicLocal(false)
    const matchedId = session.matched_session_id
    await supabase.from('sessions').update({ is_public: false, matched_session_id: null }).eq('id', session.id)
    if (matchedId) {
      await supabase.from('sessions').update({ matched_session_id: null }).eq('id', matchedId)
    }
    setSession(prev => ({ ...prev, matched_session_id: null }))
  }

  function handleTeamNameChange(val: string) {
    const cleaned = val.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 30)
    setTeamNameLocal(cleaned)
  }

  async function handleTeamNameSave() {
    await supabase.from('sessions').update({ team_name: teamNameLocal || null }).eq('id', session.id)
    setSession(prev => ({ ...prev, team_name: teamNameLocal || null }))
    setTeamNameSaved(true)
    setTimeout(() => setTeamNameSaved(false), 2000)
  }

  function toggleLookup() {
    setLookupOpen(o => {
      if (o) { setLookupDone(false); setFoundPlayer(null); setLookupPhone('') }
      return !o
    })
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!lookupLocalNumber.trim()) return
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
        const stored = JSON.parse(localStorage.getItem('bmp_my_sessions') ?? '[]')
        if (Array.isArray(stored)) {
          localStorage.setItem('bmp_my_sessions', JSON.stringify(
            stored.filter((b: { sessionId: string }) => b.sessionId !== session.id)
          ))
        }
      } catch {}
      router.push('/slots')
    } catch {
      setLeaveError('Something went wrong. Please try again.')
      setLeaveLoading(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  function shareWhatsApp() {
    const venueName = slot.venues?.name ?? 'Globe Pitch'
    const text = `Join my 5-a-side at ${venueName} — ${sliceTime(slot.start_time)}–${sliceTime(slot.end_time)} on ${formatDate(slot.date)}!\n${shareUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || sendingMsg) return
    setSendingMsg(true)
    await supabase.from('messages').insert({ session_id: session.id, content: newMsg.trim() })
    setNewMsg('')
    setSendingMsg(false)
  }

  const perPlayerPounds = (slot.price / 10 + 0.50 + 0.30).toFixed(2)
  const isOrganiserUser = !!(currentUserId && session.organiser_id && currentUserId === session.organiser_id)
  const isMyPlayerOrganiser = isOrganiserUser || !!(myPlayer && session.organiser_name && myPlayer.name.toLowerCase() === session.organiser_name.toLowerCase())
  const showLeaveButton = isFilling && !!myPlayer && !isMyPlayerOrganiser

  function renderPlayerToken(i: number, highlightId?: string, highlightName?: string) {
    const player = allPlayers[i]
    const isHighlighted = !!(player && (
      (highlightId && player.id === highlightId) ||
      (highlightName && player.name.toLowerCase() === highlightName.toLowerCase())
    ))
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
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          background: isHighlighted
            ? 'rgba(198,241,53,0.22)'
            : player
            ? 'rgba(198,241,53,0.09)'
            : 'rgba(255,255,255,0.02)',
          border: isHighlighted
            ? '2px solid rgba(198,241,53,0.7)'
            : player
            ? '1px solid rgba(198,241,53,0.28)'
            : '1px dashed rgba(255,255,255,0.07)',
          boxShadow: isHighlighted
            ? '0 0 28px rgba(198,241,53,0.35)'
            : player
            ? '0 0 20px rgba(198,241,53,0.08)'
            : 'none',
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
            fontWeight: 900,
            fontFamily: "'Archivo Black', sans-serif",
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
            fontWeight: 900,
            color: player ? 'var(--black)' : 'transparent',
            flexShrink: 0,
            fontFamily: "'Archivo Black', sans-serif",
          }}
        >
          {player ? initials : ''}
        </div>

        {player && (
          <div
            style={{
              fontSize: '7px',
              fontWeight: 700,
              color: isHighlighted ? 'var(--black)' : 'var(--green)',
              textAlign: 'center',
              lineHeight: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              padding: '0 4px',
              opacity: isHighlighted ? 1 : 0.85,
            }}
          >
            {isHighlighted ? 'You' : firstName}
          </div>
        )}
      </div>
    )
  }

  function renderOppositionToken(i: number) {
    const player = matchedPlayers[i] ?? null
    const parts = player ? player.name.trim().split(/\s+/) : []
    const firstInitial = parts[0]?.[0]?.toUpperCase() ?? ''
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : ''
    const initials = (firstInitial + lastInitial) || '?'
    const firstName = parts[0] ?? ''
    return (
      <div
        key={i}
        title={player ? player.name : `Spot ${i + 1}`}
        className={`player-token ${player ? 'filled' : ''}`}
        style={{
          position: 'relative',
          flex: 1,
          height: '60px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          background: player ? 'rgba(198,241,53,0.09)' : 'rgba(255,255,255,0.02)',
          border: player ? '1px solid rgba(198,241,53,0.28)' : '1px dashed rgba(255,255,255,0.07)',
          boxShadow: player ? '0 0 20px rgba(198,241,53,0.08)' : 'none',
          transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <div style={{ position: 'absolute', top: '4px', right: '5px', fontSize: '7px', fontWeight: 900, fontFamily: "'Archivo Black', sans-serif", color: player ? 'rgba(198,241,53,0.4)' : 'rgba(255,255,255,0.06)', lineHeight: 1 }}>
          {i + 1}
        </div>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: player ? 'var(--green)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, color: player ? 'var(--black)' : 'transparent', flexShrink: 0, fontFamily: "'Archivo Black', sans-serif" }}>
          {player ? initials : ''}
        </div>
        {player && (
          <div style={{ fontSize: '7px', fontWeight: 700, color: 'var(--green)', textAlign: 'center', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', padding: '0 4px', opacity: 0.85 }}>
            {firstName}
          </div>
        )}
      </div>
    )
  }

  if (isCancelled) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(255,68,68,0.04) 0%, #0f0f0f 100%)',
            border: '1px solid rgba(255,68,68,0.18)',
            borderRadius: '20px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            marginTop: '1rem',
          }}
        >
          <div style={{ fontSize: '38px', marginBottom: '1.25rem' }}>⚡</div>
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '22px',
              letterSpacing: '-0.04em',
              marginBottom: '0.75rem',
              lineHeight: 1.1,
              color: 'var(--text)',
            }}
          >
            Spot taken by another team
          </div>
          <div
            style={{
              fontSize: '15px',
              color: 'var(--muted)',
              lineHeight: 1.7,
              marginBottom: '2rem',
              fontWeight: 500,
            }}
          >
            This match is no longer available — another team locked in the spot first.
          </div>
          <Link href="/slots" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: 'var(--green)',
                color: 'var(--black)',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '12px',
                fontFamily: "'Archivo Black', sans-serif",
                fontWeight: 900,
                fontSize: '16px',
                letterSpacing: '-0.025em',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              Find another game →
            </button>
          </Link>
        </div>
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link
            href="/slots"
            style={{
              fontSize: '13px',
              color: 'var(--muted)',
              textDecoration: 'none',
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            ← Browse all slots
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

      {/* ============================================================
          CONFIRMED BANNER
          ============================================================ */}
      {isConfirmed && (
        <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              background: 'rgba(198,241,53,0.08)',
              border: '2px solid rgba(198,241,53,0.28)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 1.25rem',
              animation: 'checkPulse 1.2s ease-out 0.4s both',
              color: 'var(--green)',
              fontWeight: 900,
            }}
          >
            ✓
          </div>
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '30px',
              letterSpacing: '-0.04em',
              marginBottom: '0.6rem',
            }}
          >
            You&apos;re confirmed!
          </div>
          <div style={{ fontSize: '16px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto 1.5rem', fontWeight: 500 }}>
            All 10 players paid. Venue notified. See you on the pitch.
          </div>
        </div>
      )}

      {/* Alert banners */}
      {localAlreadyIn && !justJoined && !justCreated && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.22)',
            borderRadius: '12px',
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
              fontWeight: 900,
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
            borderRadius: '14px',
            padding: '1.15rem 1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '17px',
              color: 'var(--green)',
              marginBottom: '5px',
              letterSpacing: '-0.025em',
            }}
          >
            Game created!
          </div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, fontWeight: 500 }}>
            Share the link below with your mates. When 10 players join, everyone pays automatically.
          </div>
        </div>
      )}

      {justJoined && isFilling && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.2)',
            borderRadius: '12px',
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
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            ✓
          </span>
          You&apos;re in! Share the link to fill the remaining spots.
        </div>
      )}

      {/* ============================================================
          SESSION SUMMARY CARD
          ============================================================ */}
      <div
        className="anim-fade-up d-100"
        style={{
          background: isConfirmed
            ? 'linear-gradient(145deg, rgba(198,241,53,0.05) 0%, #0f0f0f 100%)'
            : 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
          border: `1px solid ${isConfirmed ? 'rgba(198,241,53,0.28)' : isFilling ? 'rgba(198,241,53,0.12)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: '18px',
          padding: '1.5rem',
          marginBottom: '1.25rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Slot info */}
        <div
          style={{
            fontSize: '10px',
            color: 'var(--muted)',
            marginBottom: '5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {slot.venues?.name ?? 'Globe Football Pitch'} · Bethnal Green
        </div>
        <div
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: '28px',
            letterSpacing: '-0.04em',
            marginBottom: '3px',
            lineHeight: 1,
          }}
        >
          {sliceTime(slot.start_time)} – {sliceTime(slot.end_time)}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem', fontWeight: 500 }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>

        {/* TEAM LINEUP */}
        <div style={{ marginBottom: '1.2rem' }}>
          {session.matched_session_id ? (
            <>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                {session.team_name || 'Team A'}
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i, myPlayer?.id ?? foundPlayer?.id, myPlayer?.name ?? foundPlayer?.name))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#C6F135', letterSpacing: '-0.02em', fontFamily: "'Archivo Black', sans-serif", flexShrink: 0 }}>
                  VS
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
              </div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                {matchedSession?.team_name || 'Team B'}
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {Array.from({ length: 5 }, (_, i) => renderOppositionToken(i))}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
                {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i, myPlayer?.id ?? foundPlayer?.id, myPlayer?.name ?? foundPlayer?.name))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ fontSize: '7px', fontWeight: 700, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>
                  5-a-side
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i + 5, myPlayer?.id ?? foundPlayer?.id, myPlayer?.name ?? foundPlayer?.name))}
              </div>
            </>
          )}
        </div>

        <SegBar count={playerCount} isConfirmed={isConfirmed} />

        <div style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'center', fontWeight: 600 }}>
          {isConfirmed ? (
            <strong style={{ color: 'var(--green)', fontWeight: 800 }}>Confirmed — all 10 players ✓</strong>
          ) : (
            <>
              <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{playerCount}/10 players</strong>
              {' '}— {remaining} more needed
            </>
          )}
        </div>

        {session.organiser_name && (
          <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', fontWeight: 500, marginTop: '0.6rem', opacity: 0.7 }}>
            Organiser: {session.organiser_name}{session.organiser_phone ? ` · ${session.organiser_phone}` : ''}
          </div>
        )}
      </div>

      {/* Match status — matched game only */}
      {matchedSession && isConfirmed && matchedSession.status === 'confirmed' && (
        <div
          className="anim-fade-up d-150"
          style={{
            background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
            border: '1px solid rgba(198,241,53,0.15)',
            borderRadius: '18px',
            padding: '1rem 1.5rem',
            marginBottom: '1.25rem',
            fontSize: '13px',
            color: 'var(--muted)',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          Match confirmed — good luck! ⚡
        </div>
      )}

      {/* Rival alert */}
      {hasRival && isFilling && (
        <div
          style={{
            background: 'rgba(255,184,0,0.06)',
            border: '1px solid rgba(255,184,0,0.22)',
            borderRadius: '12px',
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
          <span>Another group is also trying to fill this slot. First to 10 gets it.</span>
        </div>
      )}

      {/* ============================================================
          CONFIRMED BOOKING DETAILS
          ============================================================ */}
      {isConfirmed && (
        <div
          style={{
            background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '18px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '15px',
              letterSpacing: '-0.025em',
              marginBottom: '1rem',
            }}
          >
            Booking details
          </div>
          {[
            { label: 'Pitch', val: slot.venues?.name ?? 'Globe Football Pitch' },
            { label: 'Address', val: slot.venues?.address ?? '110 Globe Rd, Bethnal Green E1 4DZ' },
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
              <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{row.label}</span>
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

      {/* ============================================================
          SHARE SECTION
          ============================================================ */}
      {isFilling && (
        <>
          <div
            className="anim-fade-up d-200"
            style={{
              background: 'linear-gradient(145deg, rgba(198,241,53,0.07) 0%, rgba(198,241,53,0.03) 100%)',
              border: '1px solid rgba(198,241,53,0.28)',
              borderRadius: '18px',
              padding: '1.5rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: '18px',
                letterSpacing: '-0.03em',
                marginBottom: '5px',
              }}
            >
              Share with your team
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.1rem', lineHeight: 1.6, fontWeight: 500 }}>
              {remaining} spot{remaining !== 1 ? 's' : ''} left. Send this link to fill them.
            </div>

            {/* URL display */}
            <div
              style={{
                background: 'rgba(0,0,0,0.4)',
                borderRadius: '10px',
                padding: '0.8rem 1rem',
                fontSize: '11px',
                color: 'rgba(198,241,53,0.65)',
                wordBreak: 'break-all',
                lineHeight: 1.55,
                marginBottom: '1rem',
                fontFamily: 'monospace',
                border: '1px solid rgba(198,241,53,0.1)',
                letterSpacing: '0.01em',
              }}
            >
              {shareUrl}
            </div>

            {/* Share buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="share-copy"
                onClick={copyLink}
                style={{
                  flex: 1,
                  padding: '0.9rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--green)',
                  color: 'var(--black)',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontWeight: 900,
                  fontSize: '13px',
                  letterSpacing: '-0.015em',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                  lineHeight: 1,
                }}
              >
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
              <button
                className="share-wa"
                onClick={shareWhatsApp}
                style={{
                  flex: 1,
                  padding: '0.9rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#25D366',
                  color: '#fff',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontWeight: 900,
                  fontSize: '13px',
                  letterSpacing: '-0.015em',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                  lineHeight: 1,
                }}
              >
                WhatsApp →
              </button>
            </div>
          </div>

          {/* Opposition toggle — organiser only, ≤ 5 players */}
          {isOrganiserUser && playerCount <= 5 && (
            <div style={{ marginBottom: '1rem' }}>
              {confirmPublicOff ? (
                <div
                  style={{
                    background: 'linear-gradient(145deg, rgba(255,68,68,0.04) 0%, #0f0f0f 100%)',
                    border: '1px solid rgba(255,68,68,0.2)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: '15px',
                      letterSpacing: '-0.025em',
                      color: 'var(--text)',
                      marginBottom: '6px',
                    }}
                  >
                    Turn off opposition matching?
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
                    If a team is currently challenging you, turning this off will cancel the match and they&apos;ll need to find another game.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setConfirmPublicOff(false)}
                      style={{
                        flex: 1,
                        padding: '0.8rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--muted)',
                        fontFamily: "'Archivo Black', sans-serif",
                        fontWeight: 900,
                        fontSize: '13px',
                        letterSpacing: '-0.015em',
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPublicOff}
                      style={{
                        flex: 1,
                        padding: '0.8rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'rgba(255,68,68,0.85)',
                        color: '#fff',
                        fontFamily: "'Archivo Black', sans-serif",
                        fontWeight: 900,
                        fontSize: '13px',
                        letterSpacing: '-0.015em',
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onClick={handlePublicToggle}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface2)',
                      border: `1px solid ${isPublicLocal ? 'rgba(198,241,53,0.3)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', fontFamily: "'Archivo', sans-serif" }}>
                        Looking for opposition?
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px', fontWeight: 500 }}>
                        Make this game public so another team can challenge you
                      </div>
                    </div>
                    <div
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '100px',
                        background: isPublicLocal ? '#C6F135' : 'rgba(255,255,255,0.08)',
                        border: isPublicLocal ? 'none' : '1px solid var(--border)',
                        position: 'relative',
                        flexShrink: 0,
                        marginLeft: '1rem',
                        transition: 'background 0.2s ease, border 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '3px',
                          left: isPublicLocal ? 'calc(100% - 21px)' : '3px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: isPublicLocal ? 'var(--black)' : 'var(--muted)',
                          transition: 'left 0.2s ease, background 0.2s ease',
                        }}
                      />
                    </div>
                  </div>
                  {isPublicLocal && (
                    <>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                        <input
                          className="field-input"
                          type="text"
                          value={teamNameLocal}
                          onChange={(e) => handleTeamNameChange(e.target.value)}
                          placeholder="Team name (optional)"
                          style={{
                            flex: 1,
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '0.8rem 1rem',
                            color: 'var(--text)',
                            fontFamily: "'Archivo', sans-serif",
                            fontSize: '15px',
                            fontWeight: 600,
                            outline: 'none',
                            transition: 'border-color 0.15s ease',
                            boxSizing: 'border-box',
                          }}
                        />
                        <button
                          onClick={handleTeamNameSave}
                          style={{
                            padding: '0.8rem 1rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#C6F135',
                            color: '#000',
                            fontFamily: "'Archivo Black', sans-serif",
                            fontWeight: 900,
                            fontSize: '13px',
                            letterSpacing: '-0.015em',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          {teamNameSaved ? 'Saved ✓' : 'Save'}
                        </button>
                      </div>
                      {teamNameLocal && (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500, marginTop: '6px' }}>
                          Team name: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{teamNameLocal}</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Join CTA */}
          {!localAlreadyIn && !isOrganiserUser && (
            <Link
              href={`/session/${session.id}/join`}
              className="anim-fade-up d-300"
              style={{ textDecoration: 'none', display: 'block', marginBottom: '1.25rem' }}
            >
              <button
                className="join-btn"
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  fontSize: '18px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  background: '#C6F135',
                  color: '#000',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  transition: 'transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                  lineHeight: 1,
                  boxShadow: '0 6px 28px rgba(198,241,53,0.35)',
                }}
              >
                Join this session — £{perPlayerPounds} if confirmed
              </button>
            </Link>
          )}
        </>
      )}

      {/* ============================================================
          ALREADY JOINED? — guest lookup
          ============================================================ */}
      {isLoggedIn === false && !alreadyIn && !justJoined && !justCreated && (
        <div className="anim-fade-up d-350" style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={toggleLookup}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: 'var(--muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Archivo', sans-serif",
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
                background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px',
                padding: '1.25rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              {!lookupDone ? (
                <form onSubmit={handleLookup}>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, marginBottom: '0.85rem', lineHeight: 1.6 }}>
                    Enter the phone number you used when you joined.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div
                      className="field-input"
                      style={{
                        flex: 1,
                        display: 'flex',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'var(--surface2)',
                        transition: 'border-color 0.15s ease',
                        minWidth: 0,
                      }}
                    >
                      <select
                        value={lookupCountryCode}
                        onChange={(e) => {
                          const code = e.target.value
                          setLookupCountryCode(code)
                          setLookupPhone(code + lookupLocalNumber)
                        }}
                        style={{
                          background: 'var(--surface2)',
                          border: 'none',
                          borderRight: '1px solid var(--border)',
                          padding: '0.8rem 0.4rem 0.8rem 0.75rem',
                          color: 'var(--text)',
                          fontFamily: "'Archivo', sans-serif",
                          fontSize: '14px',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code} style={{ background: '#161616' }}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={lookupLocalNumber}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^0-9]/g, '')
                          setLookupLocalNumber(cleaned)
                          setLookupPhone(lookupCountryCode + cleaned)
                        }}
                        onKeyDown={(e) => {
                          if (e.ctrlKey || e.metaKey) return
                          if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
                          if (!/^[0-9]$/.test(e.key)) e.preventDefault()
                        }}
                        placeholder="7911 123456"
                        autoComplete="tel"
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          padding: '0.8rem 1rem',
                          color: 'var(--text)',
                          fontFamily: "'Archivo', sans-serif",
                          fontSize: '15px',
                          fontWeight: 600,
                          outline: 'none',
                          minWidth: 0,
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={lookupLoading || !lookupLocalNumber.trim()}
                      style={{
                        padding: '0.8rem 1.1rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: lookupLoading || !lookupLocalNumber.trim() ? 'var(--surface2)' : 'var(--green)',
                        color: lookupLoading || !lookupLocalNumber.trim() ? 'var(--muted)' : 'var(--black)',
                        fontFamily: "'Archivo Black', sans-serif",
                        fontWeight: 900,
                        fontSize: '13px',
                        letterSpacing: '-0.015em',
                        cursor: lookupLoading || !lookupLocalNumber.trim() ? 'not-allowed' : 'pointer',
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
                        fontWeight: 900,
                        flexShrink: 0,
                        fontFamily: "'Archivo Black', sans-serif",
                      }}
                    >
                      ✓
                    </span>
                    <div>
                      <div
                        style={{
                          fontFamily: "'Archivo Black', sans-serif",
                          fontSize: '16px',
                          letterSpacing: '-0.025em',
                          color: 'var(--text)',
                          lineHeight: 1.1,
                          marginBottom: '2px',
                        }}
                      >
                        You&apos;re in, {foundPlayer.name.split(' ')[0]}!
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                        Your spot is highlighted in the grid above.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setLookupDone(false); setFoundPlayer(null); setLookupPhone('') }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--muted)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: "'Archivo', sans-serif",
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
                        fontFamily: "'Archivo Black', sans-serif",
                        fontSize: '15px',
                        letterSpacing: '-0.025em',
                        color: 'var(--text)',
                        marginBottom: '4px',
                      }}
                    >
                      Not in this session
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6 }}>
                      That number doesn&apos;t match anyone in this game yet.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {isFilling && (
                      <Link href={`/session/${session.id}/join`} style={{ textDecoration: 'none' }}>
                        <button
                          className="btn-g"
                          style={{
                            padding: '0.65rem 1.25rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'var(--green)',
                            color: 'var(--black)',
                            fontFamily: "'Archivo Black', sans-serif",
                            fontWeight: 900,
                            fontSize: '13px',
                            letterSpacing: '-0.015em',
                            cursor: 'pointer',
                            lineHeight: 1,
                            transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                          }}
                        >
                          Join this session →
                        </button>
                      </Link>
                    )}
                    <button
                      onClick={() => { setLookupDone(false); setLookupPhone('') }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: "'Archivo', sans-serif",
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
          LEAVE GAME
          ============================================================ */}
      {showLeaveButton && (
        <div className="anim-fade-up d-400" style={{ marginBottom: '1.25rem' }}>
          {!leaveOpen ? (
            <button
              className="leave-btn"
              onClick={() => setLeaveOpen(true)}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: '#E53935',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: "'Archivo Black', sans-serif",
                letterSpacing: '-0.015em',
                transition: 'background 0.18s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                lineHeight: 1,
              }}
            >
              Leave game
            </button>
          ) : (
            <div
              style={{
                background: 'linear-gradient(145deg, rgba(255,68,68,0.04) 0%, #0f0f0f 100%)',
                border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '15px',
                  letterSpacing: '-0.025em',
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                Are you sure you want to leave this session?
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
                Your spot will be gone and you won&apos;t be charged. This can&apos;t be undone.
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
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontFamily: "'Archivo Black', sans-serif",
                    fontWeight: 900,
                    fontSize: '13px',
                    letterSpacing: '-0.015em',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeave}
                  disabled={leaveLoading}
                  style={{
                    flex: 1,
                    padding: '0.8rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: leaveLoading ? 'rgba(255,68,68,0.3)' : 'rgba(255,68,68,0.85)',
                    color: '#fff',
                    fontFamily: "'Archivo Black', sans-serif",
                    fontWeight: 900,
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
          )}
        </div>
      )}

      {/* ============================================================
          SESSION CHAT — confirmed only
          ============================================================ */}
      {isConfirmed && (
        <div>
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '18px',
              letterSpacing: '-0.03em',
              marginBottom: '1rem',
            }}
          >
            Session chat
          </div>
          <div
            style={{
              background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
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
                  color: 'var(--muted)',
                  textAlign: 'center',
                  padding: '2rem',
                  margin: 'auto',
                  fontWeight: 500,
                }}
              >
                No messages yet. Say something!
              </div>
            ) : messages.map(msg => (
              <div key={msg.id} style={{ fontSize: '14px', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--muted)', fontSize: '11px', marginRight: '8px', fontWeight: 500 }}>
                  {formatTime(msg.created_at)}
                </span>
                <span style={{ fontWeight: 600 }}>{msg.content}</span>
              </div>
            ))}
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
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: 'var(--text)',
                fontFamily: "'Archivo', sans-serif",
                fontWeight: 600,
                fontSize: '14px',
                transition: 'border-color 0.15s ease',
              }}
            />
            <button
              className="send-btn"
              type="submit"
              disabled={sendingMsg || !newMsg.trim()}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--green)',
                color: 'var(--black)',
                fontFamily: "'Archivo Black', sans-serif",
                fontWeight: 900,
                fontSize: '13px',
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                transition: 'background 0.15s ease, transform 0.12s ease',
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
            color: 'var(--muted)',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'color 0.15s ease',
            letterSpacing: '-0.01em',
          }}
        >
          ← Browse all slots
        </Link>
      </div>

      {isFilling && !localAlreadyIn && !isOrganiserUser && (
        <>
          <style>{`@media (min-width: 641px){.sticky-join-bar,.sticky-join-spacer{display:none!important}}`}</style>
          <div className="sticky-join-spacer" style={{ height: '88px' }} />
          <div
            className="sticky-join-bar"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '0.85rem 1.25rem calc(0.85rem + env(safe-area-inset-bottom))',
              background: 'rgba(10,10,10,0.92)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              zIndex: 100,
            }}
          >
            <Link href={`/session/${session.id}/join`} style={{ textDecoration: 'none', display: 'block' }}>
              <button
                style={{
                  width: '100%',
                  padding: '1.1rem',
                  fontSize: '17px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  background: '#C6F135',
                  color: '#000',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                Join this session — £{perPlayerPounds} if confirmed
              </button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
