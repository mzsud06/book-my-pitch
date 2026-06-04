'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Player {
  id: string
  name: string
  joined_at: string
  session_id: string
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

function formatPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function sliceTime(t: string): string {
  return t ? t.slice(0, 5) : t
}

/* ------------------------------------------------------------------ */
/* SegBar — module-level component (must NOT be inside SessionClient   */
/* or Turbopack Fast Refresh crashes tracking component identity)      */
/* ------------------------------------------------------------------ */
function SegBar({ count, isConfirmed }: { count: number; isConfirmed: boolean }) {
  const isAmber = count >= 7 && count < 10
  const segClass = isConfirmed ? 'lit-green' : isAmber ? 'lit-amber' : 'lit-green'
  return (
    <div className="seg-bar" style={{ marginBottom: '8px' }}>
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
}: Props) {
  const supabase = createClient()
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  const [newMsg, setNewMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [shareUrl, setShareUrl] = useState(`/session/${session.id}`)

  useEffect(() => {
    setShareUrl(`${window.location.origin}/session/${session.id}`)
  }, [session.id])

  const slot = session.slots
  const isConfirmed = session.status === 'confirmed'
  const isFilling = session.status === 'filling'

  const thisSessionPlayers = session.players.filter(p => p.session_id === session.id)
  const organiserEntry = session.organiser_name
    ? [{ id: 'organiser', name: session.organiser_name, joined_at: session.created_at, session_id: session.id }]
    : []
  const allPlayers: Player[] = [...organiserEntry, ...thisSessionPlayers]
  const playerCount = allPlayers.length
  const remaining = 10 - playerCount
  const fillPercent = (playerCount / 10) * 100

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function refetchSession() {
      Promise.all([
        supabase
          .from('sessions')
          .select(`
            id, status, created_at, organiser_name, organiser_phone,
            slots(id, date, start_time, end_time, type, price, max_players,
              venues(id, name, address)
            )
          `)
          .eq('id', session.id)
          .single(),
        supabase
          .from('players')
          .select('id, name, joined_at, session_id')
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

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

  /* ------------------------------------------------------------------ */
  /* Player token — used in the lineup grid                              */
  /* ------------------------------------------------------------------ */
  function renderPlayerToken(i: number) {
    const player = allPlayers[i]
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
          height: '58px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          background: player ? 'rgba(198,241,53,0.1)' : 'rgba(255,255,255,0.02)',
          border: player
            ? '1px solid rgba(198,241,53,0.3)'
            : '1px dashed rgba(255,255,255,0.08)',
          boxShadow: player ? '0 0 18px rgba(198,241,53,0.1)' : 'none',
          animationDelay: `${i * 40}ms`,
        }}
      >
        {/* Jersey number */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '6px',
            fontSize: '7px',
            fontWeight: 800,
            fontFamily: "'Archivo Black', sans-serif",
            color: player ? 'rgba(198,241,53,0.45)' : 'rgba(255,255,255,0.07)',
            lineHeight: 1,
            letterSpacing: '0.04em',
          }}
        >
          {i + 1}
        </div>

        {/* Avatar circle */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: player ? 'var(--green)' : 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 800,
            color: player ? 'var(--black)' : 'transparent',
            flexShrink: 0,
            fontFamily: "'Archivo Black', sans-serif",
          }}
        >
          {player ? initials : ''}
        </div>

        {/* First name */}
        {player && (
          <div
            style={{
              fontSize: '7px',
              fontWeight: 700,
              color: 'var(--green)',
              textAlign: 'center',
              lineHeight: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              padding: '0 5px',
              opacity: 0.85,
            }}
          >
            {firstName}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* ============================================================
          CONFIRMED BANNER
          ============================================================ */}
      {isConfirmed && (
        <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              background: 'rgba(198,241,53,0.1)',
              border: '2px solid rgba(198,241,53,0.3)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              margin: '0 auto 1.25rem',
              animation: 'checkPulse 1.2s ease-out 0.4s both',
            }}
          >
            ✓
          </div>
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '28px',
              letterSpacing: '-0.035em',
              marginBottom: '0.5rem',
            }}
          >
            You&apos;re confirmed!
          </div>
          <div style={{ fontSize: '16px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '1.5rem' }}>
            All 10 players paid. Venue notified. See you on the pitch.
          </div>
        </div>
      )}

      {/* Already in banner */}
      {alreadyIn && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.22)',
            borderRadius: '10px',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.25rem',
            fontSize: '15px',
            color: 'var(--green)',
            fontWeight: 700,
          }}
        >
          👋 You&apos;re already in this game!
        </div>
      )}

      {/* Game created banner */}
      {justCreated && isFilling && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.22)',
            borderRadius: '12px',
            padding: '1rem 1.15rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '16px',
              color: 'var(--green)',
              marginBottom: '4px',
              letterSpacing: '-0.02em',
            }}
          >
            Game created! 🎉
          </div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.55, fontWeight: 500 }}>
            Share the link below with your mates. When 10 players join, everyone pays automatically.
          </div>
        </div>
      )}

      {/* Just joined banner */}
      {justJoined && isFilling && (
        <div
          style={{
            background: 'rgba(198,241,53,0.06)',
            border: '1px solid rgba(198,241,53,0.18)',
            borderRadius: '10px',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.25rem',
            fontSize: '15px',
            color: 'var(--green)',
            fontWeight: 700,
          }}
        >
          ✓ You&apos;re in! Share the link below to fill the remaining spots.
        </div>
      )}

      {/* ============================================================
          SESSION SUMMARY CARD
          ============================================================ */}
      <div
        className="anim-fade-up d-100"
        style={{
          background: isConfirmed
            ? 'linear-gradient(135deg, rgba(198,241,53,0.05) 0%, var(--surface) 100%)'
            : 'var(--surface)',
          border: `1px solid ${isConfirmed ? 'rgba(198,241,53,0.25)' : isFilling ? 'rgba(198,241,53,0.12)' : 'var(--border)'}`,
          borderRadius: '16px',
          padding: '1.35rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Slot info */}
        <div
          style={{
            fontSize: '10px',
            color: 'var(--muted)',
            marginBottom: '4px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {slot.venues?.name ?? 'Globe Football Pitch'} · Bethnal Green
        </div>
        <div
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: '24px',
            letterSpacing: '-0.04em',
            marginBottom: '2px',
            lineHeight: 1,
          }}
        >
          {sliceTime(slot.start_time)} – {sliceTime(slot.end_time)}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem', fontWeight: 500 }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>

        {/* ============================================================
            TEAM LINEUP — 2 rows of 5 with center divider
            ============================================================ */}
        <div style={{ marginBottom: '1.1rem' }}>
          {/* Row 1: spots 1–5 */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
            {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i))}
          </div>

          {/* Center line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '8px 0',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <div
              style={{
                fontSize: '7px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.14)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              5-a-side
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Row 2: spots 6–10 */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: 5 }, (_, i) => renderPlayerToken(i + 5))}
          </div>
        </div>

        {/* Segmented fill bar */}
        <SegBar count={playerCount} isConfirmed={isConfirmed} />

        {/* Player count */}
        <div style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'center' }}>
          {isConfirmed ? (
            <strong style={{ color: 'var(--green)' }}>Confirmed — all 10 players ✓</strong>
          ) : (
            <>
              <strong style={{ color: 'var(--text)' }}>{playerCount}/10 players</strong>
              {' '}— {remaining} more needed
            </>
          )}
        </div>
      </div>

      {/* Rival alert */}
      {hasRival && isFilling && (
        <div
          style={{
            background: 'rgba(255,184,0,0.07)',
            border: '1px solid rgba(255,184,0,0.22)',
            borderRadius: '10px',
            padding: '0.8rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '14px',
            color: 'var(--amber)',
            display: 'flex',
            gap: '8px',
            lineHeight: 1.55,
            fontWeight: 600,
          }}
        >
          ⚡ Another group is also trying to fill this slot. First to 10 gets it.
        </div>
      )}

      {/* ============================================================
          CONFIRMED BOOKING DETAILS
          ============================================================ */}
      {isConfirmed && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.35rem',
            marginBottom: '1.5rem',
          }}
        >
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
                padding: '0.55rem 0',
                borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{row.label}</span>
              <span
                style={{
                  fontWeight: 800,
                  color: row.label === 'Your cost' || row.label === 'Status' ? 'var(--green)' : 'var(--text)',
                }}
              >
                {row.val}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================
          SHARE SECTION — filling sessions
          ============================================================ */}
      {isFilling && (
        <>
          <div
            className="anim-fade-up d-200"
            style={{
              background: 'linear-gradient(135deg, rgba(198,241,53,0.08) 0%, rgba(198,241,53,0.03) 100%)',
              border: '1px solid rgba(198,241,53,0.3)',
              borderRadius: '16px',
              padding: '1.35rem',
              marginBottom: '1.1rem',
            }}
          >
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: '17px',
                letterSpacing: '-0.025em',
                marginBottom: '4px',
              }}
            >
              Share with your team
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.55, fontWeight: 500 }}>
              {remaining} spot{remaining !== 1 ? 's' : ''} left. Send this link to fill them.
            </div>

            {/* URL display */}
            <div
              style={{
                background: 'rgba(0,0,0,0.35)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '11px',
                color: 'rgba(198,241,53,0.7)',
                wordBreak: 'break-all',
                lineHeight: 1.55,
                marginBottom: '0.9rem',
                fontFamily: 'monospace',
                border: '1px solid rgba(198,241,53,0.12)',
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
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--green)',
                  color: 'var(--black)',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontWeight: 800,
                  fontSize: '13px',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                }}
              >
                {copied ? '✓ Copied!' : '📋 Copy link'}
              </button>
              <button
                className="share-wa"
                onClick={shareWhatsApp}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#25D366',
                  color: '#fff',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontWeight: 800,
                  fontSize: '13px',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                }}
              >
                WhatsApp →
              </button>
            </div>
          </div>

          {/* Join CTA */}
          <Link
            href={`/session/${session.id}/join`}
            className="anim-fade-up d-300"
            style={{ textDecoration: 'none', display: 'block', marginBottom: '1.25rem' }}
          >
            <button
              className="join-btn"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '15px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontFamily: "'Archivo', sans-serif",
                fontWeight: 700,
                transition: 'border-color 0.2s ease, background 0.2s ease, transform 0.2s var(--ease-out), box-shadow 0.2s ease',
              }}
            >
              Join this session — £{perPlayerPounds} if confirmed
            </button>
          </Link>
        </>
      )}

      {/* ============================================================
          SESSION CHAT — confirmed only
          ============================================================ */}
      {isConfirmed && (
        <div>
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: '17px',
              letterSpacing: '-0.025em',
              marginBottom: '0.85rem',
            }}
          >
            Session chat
          </div>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '1rem',
              minHeight: '200px',
              maxHeight: '360px',
              overflowY: 'auto',
              marginBottom: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
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
                No messages yet. Say something! ⚽
              </div>
            ) : messages.map(msg => (
              <div key={msg.id} style={{ fontSize: '14px', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--muted)', fontSize: '11px', marginRight: '8px', fontWeight: 500 }}>
                  {formatTime(msg.created_at)}
                </span>
                <span>{msg.content}</span>
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
                borderRadius: '8px',
                padding: '0.65rem 0.9rem',
                color: 'var(--text)',
                fontFamily: "'Archivo', sans-serif",
                fontSize: '14px',
                transition: 'border-color 0.15s ease',
              }}
            />
            <button
              className="send-btn"
              type="submit"
              disabled={sendingMsg || !newMsg.trim()}
              style={{
                padding: '0.65rem 1.15rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--green)',
                color: 'var(--black)',
                fontFamily: "'Archivo Black', sans-serif",
                fontWeight: 800,
                fontSize: '13px',
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                transition: 'background 0.15s ease, transform 0.12s ease',
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
        <Link
          href="/slots"
          style={{
            fontSize: '13px',
            color: 'var(--muted)',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'color 0.15s ease',
          }}
        >
          ← Browse all slots
        </Link>
      </div>
    </div>
  )
}
