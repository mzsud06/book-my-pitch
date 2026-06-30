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
  sender_name: string | null
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
  const [convertOpen, setConvertOpen] = useState<'open' | 'lfo' | null>(null)
  const [lfoStep, setLfoStep] = useState<'confirm' | 'name'>('confirm')
  const [lfoTeamName, setLfoTeamName] = useState('')
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
  const isFull = isFilling && playerCount >= slot.max_players
  const isLFOOrMatched = !!(session.matched_session_id || session.game_type === 'looking_for_opposition')
  const urgencyCap = isLFOOrMatched ? 5 : slot.max_players
  const urgencySpotsLeft = urgencyCap - playerCount
  const showJoinUrgency = isFilling && !isFull && urgencySpotsLeft > 0 && urgencySpotsLeft <= (isLFOOrMatched ? 1 : 2)
  const returningPlayerIndex = returningPlayer ? allPlayers.findIndex(p => p.id === returningPlayer.id) : -1
  const returningPlayerJerseyNumber = returningPlayerIndex >= 0 ? returningPlayerIndex + 1 : null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function refetchSession() {
      Promise.all([
        supabase
          .from('sessions')
          .select(`
            id, status, created_at, organiser_name, organiser_phone, organiser_id, matched_session_id, team_name, game_type, is_public,
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

      // Returning guest: check session-specific localStorage entry and validate phone via DB
      if (!user) {
        try {
          const lsEntry = localStorage.getItem(`bmp_player_${initialSession.id}`)
          if (lsEntry) {
            const { phone: storedPhone } = JSON.parse(lsEntry) as { phone?: string }
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
          }
        } catch {}
        setReturningPlayerChecked(true)
      }

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

  useEffect(() => {
    if (!justJoined || isLoggedIn !== false) return
    if (session.game_type === 'open') return
    if (sessionStorage.getItem('bmp_join_popup_dismissed')) return
    setShowRegisterPopup(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

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
    setIsPublicLocal(true)
    setConvertOpen(null)
    setConverting(false)
  }

  async function handleConvertToLfo() {
    setConverting(true)
    setConvertError('')
    const trimmedName = lfoTeamName.trim()
    const { error } = await supabase
      .from('sessions')
      .update({ game_type: 'looking_for_opposition', is_public: true, team_name: trimmedName || null })
      .eq('id', session.id)
    if (error) {
      setConvertError('Failed to update. Please try again.')
      setConverting(false)
      return
    }
    setSession(prev => ({ ...prev, game_type: 'looking_for_opposition', is_public: true, team_name: trimmedName || null }))
    setIsPublicLocal(true)
    setTeamNameLocal(trimmedName)
    setConvertOpen(null)
    setLfoTeamName('')
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
      if (userId && myPlayer?.id && myPlayer.id !== 'organiser') {
        await fetch('/api/link-player-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: myPlayer.id, userId }),
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
        const stored = JSON.parse(localStorage.getItem('bmp_my_sessions') ?? '[]')
        if (Array.isArray(stored)) {
          localStorage.setItem('bmp_my_sessions', JSON.stringify(
            stored.filter((b: { sessionId: string }) => b.sessionId !== session.id)
          ))
        }
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
        localStorage.removeItem(`bmp_player_${session.id}`)
        const stored = JSON.parse(localStorage.getItem('bmp_my_sessions') ?? '[]')
        if (Array.isArray(stored)) {
          localStorage.setItem('bmp_my_sessions', JSON.stringify(
            stored.filter((b: { sessionId: string }) => b.sessionId !== session.id)
          ))
        }
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

  function shareWhatsApp() {
    const venueName = slot.venues?.name ?? 'Globe Pitch'
    const text = `Join my 5-a-side at ${venueName} — ${sliceTime(slot.start_time)}–${sliceTime(slot.end_time)} on ${formatDate(slot.date)}!\n${shareUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || sendingMsg) return
    setSendingMsg(true)
    await supabase.from('messages').insert({
      session_id: session.id,
      content: newMsg.trim(),
      sender_name: myPlayer?.name ?? null,
    })
    setNewMsg('')
    setSendingMsg(false)
  }

  const perPlayerPounds = (slot.price / 10 + 0.50 + 0.30).toFixed(2)
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
          borderRadius: 'var(--radius-lg)',
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
        <div style={{ position: 'absolute', top: '4px', right: '5px', fontSize: '7px', fontWeight: 700, fontFamily: 'var(--font-display)', color: player ? 'rgba(198,241,53,0.4)' : 'rgba(255,255,255,0.06)', lineHeight: 1 }}>
          {i + 1}
        </div>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: player ? 'var(--green)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: player ? 'var(--black)' : 'transparent', flexShrink: 0, fontFamily: 'var(--font-display)' }}>
          {player ? initials : ''}
        </div>
        {player && (
          <div style={{ fontSize: '7px', fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', padding: '0 4px', opacity: 0.85 }}>
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
            This game was cancelled
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
            No charge was made.
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
              color: 'var(--muted)',
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
            ✓ Game Confirmed — {formatDate(slot.date)} · {sliceTime(slot.start_time)} · Globe Football Pitch
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
              <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '12px' }}>
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
                    color: 'var(--muted)', fontFamily: 'var(--font-display)',
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
                    color: '#fff', fontFamily: 'var(--font-display)',
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
            Game confirmed ✓ · £{perPlayerPounds} was taken from your card · {formatDate(slot.date)} · {sliceTime(slot.start_time)}–{sliceTime(slot.end_time)} · {slot.venues?.name ?? 'Globe Football Pitch'}
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
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            letterSpacing: '-0.04em',
            marginBottom: '3px',
            lineHeight: 1,
          }}
        >
          {sliceTime(slot.start_time)} – {sliceTime(slot.end_time)}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 500 }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>
        <a
          href="https://www.google.com/maps/search/?api=1&query=110+Globe+Rd+Bethnal+Green+London+E1+4DZ"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-block', fontSize: '12px', color: 'rgba(198,241,53,0.65)', fontWeight: 600, textDecoration: 'underline', marginBottom: '1.5rem', textUnderlineOffset: '2px' }}
        >
          Get directions →
        </a>

        {/* TEAM LINEUP */}
        <div style={{ marginBottom: '1.2rem' }}>
          {(session.matched_session_id || matchedSession || session.game_type === 'looking_for_opposition') ? (
            <>
              {/* Team A */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.65 }}>
                  {session.team_name || 'Team A'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
                {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i))}
              </div>

              {/* VS divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{
                  padding: '4px 16px',
                  borderRadius: '20px',
                  border: '1px solid rgba(198,241,53,0.28)',
                  background: 'rgba(198,241,53,0.05)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--green)',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--font-display)',
                  flexShrink: 0,
                }}>
                  VS
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Team B */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.65 }}>
                  {matchedSession?.team_name || 'Team B'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
                {Array.from({ length: 5 }, (_, i) => renderOppositionToken(i))}
              </div>

              {/* Per-team count */}
              <div style={{ marginTop: '14px' }}>
                {isConfirmed ? (
                  <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, color: 'var(--green)' }}>Confirmed — both teams ✓</div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <div style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(198,241,53,0.07)', border: '1px solid rgba(198,241,53,0.2)', fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                      {session.team_name || 'Team A'}: {Math.min(allPlayers.length, 5)}/5
                    </div>
                    <div style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                      {matchedSession?.team_name || 'Team B'}: {matchedPlayers.length}/5
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
                {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ fontSize: '7px', fontWeight: 700, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>
                  5-a-side
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i + 5))}
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
            background: 'var(--surface)',
            border: '1px solid rgba(198,241,53,0.2)',
            borderRadius: 'var(--radius-xl)',
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
      {hasRival && isFilling && session.game_type !== 'looking_for_opposition' && (
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
          <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
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
          {(() => {
            const shareCap = (session.matched_session_id || session.game_type === 'looking_for_opposition') ? 5 : slot.max_players
            return playerCount < shareCap
          })() && (
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
                color: '#fff',
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
          {isOrganiserUser && session.game_type === 'private' && !session.matched_session_id && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
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
                    Make this an open game?
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
                    Anyone will be able to find and join this game publicly.
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
                        color: 'var(--muted)', fontFamily: 'var(--font-display)',
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
                        color: converting ? 'var(--muted)' : 'var(--text)',
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
              ) : convertOpen === 'lfo' ? (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                  }}
                >
                  {lfoStep === 'confirm' ? (
                    <>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: '6px' }}>
                        Look for opposition?
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
                        Your game will be listed publicly so another team of 5 can challenge you. If you already have more than 5 players this option won&apos;t be available.
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => { setConvertOpen(null); setConvertError('') }}
                          style={{
                            flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--muted)', fontFamily: 'var(--font-display)',
                            fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em', cursor: 'pointer', lineHeight: 1,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setLfoStep('name')}
                          style={{
                            flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                            border: 'none', background: 'rgba(255,255,255,0.1)',
                            color: 'var(--text)', fontFamily: 'var(--font-display)',
                            fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em', cursor: 'pointer', lineHeight: 1,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          Yes, list it
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: '8px' }}>
                        Set a team name (optional)
                      </div>
                      <input
                        className="field-input"
                        type="text"
                        value={lfoTeamName}
                        onChange={(e) => setLfoTeamName(e.target.value.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 30))}
                        placeholder="e.g. The Wanderers"
                        style={{
                          width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', color: 'var(--text)',
                          fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
                          outline: 'none', marginBottom: '1rem', boxSizing: 'border-box',
                          transition: 'border-color 0.15s ease',
                        }}
                      />
                      {convertError && (
                        <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginBottom: '0.75rem' }}>
                          {convertError}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => { setLfoStep('confirm'); setConvertError('') }}
                          disabled={converting}
                          style={{
                            flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--muted)', fontFamily: 'var(--font-display)',
                            fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em', cursor: 'pointer', lineHeight: 1,
                          }}
                        >
                          Back
                        </button>
                        <button
                          onClick={handleConvertToLfo}
                          disabled={converting}
                          style={{
                            flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                            border: 'none',
                            background: converting ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
                            color: converting ? 'var(--muted)' : 'var(--text)',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                            cursor: converting ? 'not-allowed' : 'pointer', lineHeight: 1,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {converting ? 'Saving…' : 'List publicly'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    className="settings-btn"
                    onClick={() => { setConvertOpen('open'); setConvertError('') }}
                    style={{
                      width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface2)',
                      color: 'var(--muted)', fontFamily: 'var(--font-sans)',
                      fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      textAlign: 'left', lineHeight: 1,
                    }}
                  >
                    Make this an open game
                  </button>
                  {playerCount <= 5 && (
                    <button
                      className="settings-btn"
                      onClick={() => { setConvertOpen('lfo'); setLfoStep('confirm'); setConvertError('') }}
                      style={{
                        width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-lg)',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface2)',
                        color: 'var(--muted)', fontFamily: 'var(--font-sans)',
                        fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                        textAlign: 'left', lineHeight: 1,
                      }}
                    >
                      Look for opposition
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              LFO SETTINGS — looking_for_opposition, organiser only
              ============================================================ */}
          {isOrganiserUser && session.game_type === 'looking_for_opposition' && !session.matched_session_id && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                Your listing
              </div>

              {/* Team name editor */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.1rem',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '6px' }}>
                  Team name
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={teamNameLocal}
                    onChange={e => handleTeamNameChange(e.target.value)}
                    placeholder="e.g. The Lads"
                    style={{
                      flex: 1,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleTeamNameSave}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--green)',
                      color: 'var(--black)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {teamNameSaved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Stop looking for opposition */}
              {!confirmPublicOff ? (
                <button
                  className="settings-btn"
                  onClick={handlePublicToggle}
                  style={{
                    width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface2)',
                    color: 'var(--muted)', fontFamily: 'var(--font-sans)',
                    fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                    textAlign: 'left', lineHeight: 1,
                  }}
                >
                  Stop looking for opposition
                </button>
              ) : (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: '6px' }}>
                    Stop looking for opposition?
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
                    Your listing will be removed. Any pending challenge will be cancelled.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setConfirmPublicOff(false)}
                      style={{
                        flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--muted)', fontFamily: 'var(--font-display)',
                        fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em', cursor: 'pointer', lineHeight: 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPublicOff}
                      style={{
                        flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-lg)',
                        border: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                        cursor: 'pointer', lineHeight: 1,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      Confirm
                    </button>
                  </div>
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
                <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
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
                    Browse game times →
                  </button>
                </Link>
              </div>
            ) : isLoggedIn === false && session.game_type === 'open' ? (
              <Link
                href={`/auth/login?redirect=${encodeURIComponent(`/session/${session.id}/join`)}`}
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
              <Link
                href={`/session/${session.id}/join`}
                className="anim-fade-up d-300"
                style={{ textDecoration: 'none', display: 'block', marginBottom: '1.25rem' }}
              >
                <button
                  className="btn-g"
                  style={{
                    width: '100%',
                    padding: '1.25rem',
                    fontSize: '18px',
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    transition: 'transform 0.18s var(--ease-out), box-shadow 0.18s ease, background 0.15s ease',
                    lineHeight: 1,
                    boxShadow: '0 6px 28px rgba(198,241,53,0.35)',
                  }}
                >
                  Join this game — £{perPlayerPounds} if confirmed
                </button>
              </Link>
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
              color: 'var(--muted)',
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
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, marginBottom: '0.85rem', lineHeight: 1.6 }}>
                    Joined from a different device? Enter your number to find your spot.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div
                      className="field-input"
                      style={{
                        flex: 1,
                        display: 'flex',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
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
                          fontFamily: 'var(--font-sans)',
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
                          fontFamily: 'var(--font-sans)',
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
                        borderRadius: 'var(--radius-lg)',
                        border: 'none',
                        background: lookupLoading || !lookupLocalNumber.trim() ? 'var(--surface2)' : 'var(--green)',
                        color: lookupLoading || !lookupLocalNumber.trim() ? 'var(--muted)' : 'var(--black)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
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
                          Join this game →
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
      {(showLeaveButton || (isOrganiserUser && isFilling && (session.game_type === 'private' || session.game_type === 'looking_for_opposition'))) && !leaveOpen && !cancelOpen && (
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
          {isOrganiserUser && isFilling && (session.game_type === 'private' || session.game_type === 'looking_for_opposition') && (
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
              {session.matched_session_id ? 'Withdraw challenge' : 'Cancel game'}
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
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
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
                  color: 'var(--muted)',
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
                  color: '#fff',
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
      {isOrganiserUser && isFilling && (session.game_type === 'private' || session.game_type === 'looking_for_opposition') && cancelOpen && (
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
              {session.matched_session_id ? 'Withdraw your challenge?' : 'Are you sure you want to cancel this game?'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem' }}>
              {session.matched_session_id
                ? "Your team's spot will be removed and the original game will be freed up for other challengers. No one will be charged."
                : 'All players will lose their spot and the game time will open back up. No one will be charged.'}
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
                  color: 'var(--muted)', fontFamily: 'var(--font-display)',
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
                  color: '#fff', fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: '13px', letterSpacing: '-0.015em',
                  cursor: cancelLoading ? 'not-allowed' : 'pointer', lineHeight: 1,
                  transition: 'background 0.15s ease',
                }}
              >
                {cancelLoading
                  ? (session.matched_session_id ? 'Withdrawing…' : 'Cancelling…')
                  : (session.matched_session_id ? 'Yes, withdraw' : 'Yes, cancel')}
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
                  color: 'var(--muted)',
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
              ;[...allPlayers, ...matchedPlayers].forEach(p => {
                if (p.user_id) playerNameMap.set(p.user_id, p.name)
              })
              console.log('[Chat debug] messages:', messages.map(m => ({ id: m.id, user_id: m.user_id, sender_name: (m as unknown as Record<string,unknown>).sender_name })))
              console.log('[Chat debug] players:', [...allPlayers, ...matchedPlayers].map(p => ({ name: p.name, user_id: p.user_id })))
              return messages.map(msg => {
                const isOwn = !!currentUserId && msg.user_id === currentUserId
                const senderName = msg.sender_name
                  ?? (msg.user_id ? (playerNameMap.get(msg.user_id) ?? 'Player') : 'Guest')
                const time = new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '3px', fontWeight: 500 }}>
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
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>
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
            color: 'var(--muted)',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'color 0.15s ease',
            letterSpacing: '-0.01em',
          }}
        >
          ← Browse all game times
        </Link>
      </div>

      {isFilling && !isFull && !localAlreadyIn && !isOrganiserUser && (
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
            {isLoggedIn === false && session.game_type === 'open' ? (
              <Link
                href={`/auth/login?redirect=${encodeURIComponent(`/session/${session.id}/join`)}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <button
                  style={{
                    width: '100%',
                    minHeight: '56px',
                    fontSize: '16px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}
                >
                  Log in to join →
                </button>
              </Link>
            ) : (
              <Link href={`/session/${session.id}/join`} style={{ textDecoration: 'none', display: 'block' }}>
                <button
                  style={{
                    width: '100%',
                    minHeight: '56px',
                    fontSize: '16px',
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}
                >
                  Join this game — £{perPlayerPounds} if confirmed
                </button>
              </Link>
            )}
          </div>
        </>
      )}

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
                    color: 'var(--muted)',
                    lineHeight: 1.6,
                    fontWeight: 500,
                    marginBottom: '1.5rem',
                  }}
                >
                  We&apos;ll let you know the moment all 10 spots fill. Check your email to verify your account.
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
                    color: 'var(--muted)',
                    lineHeight: 1.6,
                    fontWeight: 500,
                    marginBottom: '1.5rem',
                  }}
                >
                  Create a free account and we&apos;ll notify you the moment all 10 spots fill.
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
                      color: 'var(--muted)',
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
  )
}
