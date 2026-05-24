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

/** Strip seconds off DB time strings like "18:30:00" → "18:30" */
function sliceTime(t: string): string {
  return t ? t.slice(0, 5) : t
}



export default function SessionClient({ session: initialSession, hasRival, initialMessages, justJoined, justCreated, alreadyIn }: Props) {
  const supabase = createClient()
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  const [newMsg, setNewMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Initialise with the relative path so SSR and first client render match,
  // then update to the full URL after hydration to avoid a mismatch.
  const [shareUrl, setShareUrl] = useState(`/session/${session.id}`)

  useEffect(() => {
    setShareUrl(`${window.location.origin}/session/${session.id}`)
  }, [session.id])

  const slot = session.slots
  const isConfirmed = session.status === 'confirmed'
  const isFilling = session.status === 'filling'

  // Build the full player list: organiser first (only if still set), then joiners.
  // Explicitly filter session.players to only this session's id — guards against
  // any embedded or cached data bleeding in from other sessions for the same slot.
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
        // Normalize nested arrays the same way the server page does
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

  return (
    <div style={{ maxWidth: '460px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <style>{`
        .msg-input:focus { border-color: rgba(200,244,0,0.4) !important; outline: none; }
        .share-copy:hover { background: rgba(200,244,0,0.85) !important; }
        .share-wa:hover { background: rgba(37,211,102,0.85) !important; }
        .join-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      `}</style>

      {/* Confirmed banner */}
      {isConfirmed && (
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'rgba(200,244,0,0.1)', border: '1px solid rgba(200,244,0,0.2)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 1.25rem',
          }}>✓</div>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '26px', letterSpacing: '-1px', marginBottom: '0.5rem' }}>
            You&apos;re confirmed!
          </div>
          <div style={{ fontSize: '16px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            All 10 players paid. Venue notified. See you on the pitch.
          </div>
        </div>
      )}

      {/* "Already in this game" banner */}
      {alreadyIn && (
        <div style={{
          background: 'rgba(200,244,0,0.06)', border: '1px solid rgba(200,244,0,0.2)',
          borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
          fontSize: '15px', color: 'var(--green)', fontWeight: 700,
        }}>
          👋 You&apos;re already in this game!
        </div>
      )}

      {/* "Game created" banner */}
      {justCreated && isFilling && (
        <div style={{
          background: 'rgba(200,244,0,0.06)', border: '1px solid rgba(200,244,0,0.2)',
          borderRadius: '10px', padding: '1rem 1.1rem', marginBottom: '1.25rem',
        }}>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '16px', color: 'var(--green)', marginBottom: '4px' }}>
            Game created! 🎉
          </div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
            Share the link below with your mates. When 10 players join, everyone pays automatically.
          </div>
        </div>
      )}

      {/* "Just joined" banner */}
      {justJoined && isFilling && (
        <div style={{
          background: 'rgba(200,244,0,0.06)', border: '1px solid rgba(200,244,0,0.15)',
          borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
          fontSize: '15px', color: 'var(--green)', fontWeight: 700,
        }}>
          ✓ You&apos;re in! Share the link below to fill the remaining spots.
        </div>
      )}

      {/* Session summary card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {slot.venues?.name ?? 'Globe Football Pitch'} · Bethnal Green
        </div>
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', letterSpacing: '-0.5px', marginBottom: '2px' }}>
          {sliceTime(slot.start_time)} – {sliceTime(slot.end_time)}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '1rem' }}>
          {formatDate(slot.date)} · {slot.type === 'peak' ? 'Peak' : slot.type === 'offpeak' ? 'Off-peak' : 'Weekend'} · 5-a-side
        </div>

        {/* Player grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '0.75rem' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const player = allPlayers[i]
            const name = player ? formatPlayerName(player.name) : null
            return (
              <div
                key={i}
                title={player ? player.name : `Spot ${i + 1}`}
                style={{
                  height: '36px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: name && name.length > 5 ? '9px' : '11px', fontWeight: 700,
                  background: player ? 'rgba(200,244,0,0.12)' : 'var(--surface2)',
                  border: player ? '1px solid rgba(200,244,0,0.25)' : '1px dashed rgba(255,255,255,0.07)',
                  color: player ? 'var(--green)' : 'var(--muted)',
                  overflow: 'hidden', padding: '0 2px',
                  textAlign: 'center', lineHeight: 1.1,
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}
              >
                {name ?? '+1'}
              </div>
            )
          })}
        </div>

        {/* Fill bar */}
        <div style={{ background: 'var(--surface2)', borderRadius: '100px', height: '6px', overflow: 'hidden', marginBottom: '6px' }}>
          <div style={{
            height: '100%', borderRadius: '100px',
            background: isConfirmed ? 'var(--green)' : fillPercent >= 70 ? 'var(--amber)' : 'var(--green)',
            width: `${fillPercent}%`, transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'center' }}>
          {isConfirmed ? (
            <strong style={{ color: 'var(--green)' }}>Confirmed — all 10 players ✓</strong>
          ) : (
            <><strong style={{ color: 'var(--text)' }}>{playerCount}/10 players</strong> — {remaining} more needed</>
          )}
        </div>
      </div>

      {/* Rival alert */}
      {hasRival && isFilling && (
        <div style={{
          background: 'rgba(255,184,0,0.07)', border: '1px solid rgba(255,184,0,0.2)',
          borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
          fontSize: '14px', color: 'var(--amber)', display: 'flex', gap: '8px', lineHeight: 1.5,
        }}>
          ⚡ Another group is also trying to fill this slot. First to 10 gets it.
        </div>
      )}

      {/* Confirmed booking details */}
      {isConfirmed && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Pitch', val: slot.venues?.name ?? 'Globe Football Pitch' },
            { label: 'Address', val: slot.venues?.address ?? '110 Globe Rd, Bethnal Green E1 4DZ' },
            { label: 'Date', val: formatDate(slot.date) },
            { label: 'Time', val: `${sliceTime(slot.start_time)} – ${sliceTime(slot.end_time)}` },
            { label: 'Your cost', val: `£${perPlayerPounds}` },
            { label: 'Status', val: 'Confirmed ✓' },
          ].map((row, idx, arr) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', fontSize: '15px',
              padding: '0.5rem 0',
              borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ color: 'var(--muted)' }}>{row.label}</span>
              <span style={{ fontWeight: 800, color: row.label === 'Your cost' || row.label === 'Status' ? 'var(--green)' : 'var(--text)' }}>{row.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Share section — filling sessions */}
      {isFilling && (
        <>
          {/* Share card — always shown first, before the Join CTA */}
          <div style={{
            background: 'rgba(200,244,0,0.06)',
            border: '1px solid rgba(200,244,0,0.3)',
            borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem',
          }}>
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '16px', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              📤 Share with your team
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
              {remaining} spot{remaining !== 1 ? 's' : ''} left — send this link to fill them. Anyone with the link can join.
            </div>

            {/* URL display */}
            <div style={{
              background: 'var(--surface2)', borderRadius: '8px', padding: '0.75rem 1rem',
              fontSize: '13px', color: 'rgba(200,244,0,0.85)', wordBreak: 'break-all',
              lineHeight: 1.5, marginBottom: '0.85rem', fontFamily: 'monospace',
              border: '1px solid rgba(200,244,0,0.15)',
            }}>
              {shareUrl}
            </div>

            {/* Share buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="share-copy"
                onClick={copyLink}
                style={{
                  flex: 1, padding: '0.8rem', borderRadius: '8px', border: 'none',
                  background: 'var(--green)', color: 'var(--black)',
                  fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                {copied ? '✓ Copied!' : '📋 Copy link'}
              </button>
              <button
                className="share-wa"
                onClick={shareWhatsApp}
                style={{
                  flex: 1, padding: '0.8rem', borderRadius: '8px', border: 'none',
                  background: '#25D366', color: '#fff',
                  fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                WhatsApp →
              </button>
            </div>
          </div>

          {/* Join CTA — for people who haven't joined yet */}
          <Link href={`/session/${session.id}/join`} style={{ textDecoration: 'none' }}>
            <button className="join-btn" style={{
              width: '100%', padding: '0.9rem', fontSize: '15px', borderRadius: '10px',
              border: '1px solid var(--border)',
              cursor: 'pointer', background: 'var(--surface)', color: 'var(--text)',
              fontFamily: "'Archivo', sans-serif", fontWeight: 700, marginBottom: '1.25rem',
              transition: 'all 0.15s',
            }}>
              Join this session — £{perPlayerPounds} if confirmed
            </button>
          </Link>
        </>
      )}

      {/* In-session chat — only after confirmed */}
      {isConfirmed && (
        <div>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '16px', letterSpacing: '-0.5px', marginBottom: '1rem' }}>
            Session chat
          </div>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
            padding: '1rem', minHeight: '200px', maxHeight: '360px', overflowY: 'auto',
            marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            {messages.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '2rem', margin: 'auto' }}>
                No messages yet. Say something! ⚽
              </div>
            ) : messages.map(msg => (
              <div key={msg.id} style={{ fontSize: '14px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--muted)', fontSize: '11px', marginRight: '8px' }}>{formatTime(msg.created_at)}</span>
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
                flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text)',
                fontFamily: "'Archivo', sans-serif", fontSize: '14px',
              }}
            />
            <button className="send-btn" type="submit" disabled={sendingMsg || !newMsg.trim()} style={{
              padding: '0.65rem 1.1rem', borderRadius: '8px', border: 'none',
              background: 'var(--green)', color: 'var(--black)',
              fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}>
              Send
            </button>
          </form>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <Link href="/slots" style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'none' }}>
          ← Browse all slots
        </Link>
      </div>
    </div>
  )
}
