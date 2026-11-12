import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { expireIfNeeded } from '@/lib/gameLifecycle'
import {
  CONFIRM_WINDOW_HOURS, GAME_COLS, GameRow, formatGameDate, formatTime, isValidUUID, paidSpots, pounds,
} from '@/lib/games'
import { PLAYER_FEE_PENCE } from '@/lib/stripe-constants'
import Nav from '@/components/Nav'
import OrganiserPanel from './OrganiserPanel'
import JoinPanel from './JoinPanel'

export const dynamic = 'force-dynamic'

const BANNERS: Record<string, string> = {
  confirmed: 'Confirmed. The pitch is booked and everyone has been charged.',
  cancelled: 'This game was cancelled. Nobody was charged.',
  expired: 'This game has passed. Nobody was charged.',
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidUUID(id)) notFound()

  const svc = createServiceClient()
  const { data } = await svc.from('sessions').select(GAME_COLS).eq('id', id).maybeSingle()
  const game = data as GameRow | null
  if (!game || game.game_kind !== 'organiser') notFound()

  game.status = await expireIfNeeded(svc, game)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isOrganiser = !!user && user.id === game.organiser_id

  const { data: playerRows } = await svc
    .from('players')
    .select('id, name, user_id')
    .eq('session_id', id)
    .order('joined_at', { ascending: true })
  const players = (playerRows ?? []) as { id: string; name: string; user_id: string | null }[]
  const viewerJoined = !!user && players.some(p => p.user_id === user.id)

  const spots = paidSpots(game)
  const share = game.share_pence ?? 0
  const when = `${formatGameDate(game.game_date!)} at ${formatTime(game.start_time!)}`
  const deadline = game.full_at
    ? new Date(new Date(game.full_at).getTime() + CONFIRM_WINDOW_HOURS * 3_600_000).toISOString()
    : null

  return (
    <>
      <Nav />
      <main style={{ maxWidth: '560px', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        <h1 style={{ fontSize: 'var(--text-h2)', letterSpacing: '-0.03em', marginBottom: '0.4rem' }}>
          {game.title ?? 'Football'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {game.venue_name}, {when}. Organised by {game.organiser_name}.
        </p>

        {BANNERS[game.status] && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '0.9rem 1.1rem', marginBottom: '1.25rem', fontWeight: 600, fontSize: '15px' }}>
            {BANNERS[game.status]}
          </div>
        )}
        {game.status === 'full' && !isOrganiser && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '0.9rem 1.1rem', marginBottom: '1.25rem', fontWeight: 600, fontSize: '15px' }}>
            Everyone has paid in. Waiting for {game.organiser_name} to book the pitch. You are only charged once they do.
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.9rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '-0.03em' }}>
              {players.length}/{spots}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>paid spots filled</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {game.organiser_plays && (
              <span style={{ background: 'var(--green-faint)', border: '1px solid var(--border-active)', borderRadius: 'var(--radius-full)', padding: '0.3rem 0.8rem', fontSize: '13px', fontWeight: 600 }}>
                {shortName(game.organiser_name ?? 'Organiser')} (organiser)
              </span>
            )}
            {players.map(p => (
              <span key={p.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '0.3rem 0.8rem', fontSize: '13px', fontWeight: 600 }}>
                {shortName(p.name)}
              </span>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
            Your share of the pitch: {pounds(share)}. Fee: {PLAYER_FEE_PENCE}p. You pay{' '}
            <strong style={{ color: 'var(--text)' }}>{pounds(share + PLAYER_FEE_PENCE)}</strong>.
          </div>
        </div>

        {isOrganiser ? (
          <OrganiserPanel
            gameId={id}
            status={game.status}
            deadline={deadline}
            collectPence={share * spots}
            filled={players.length}
            spots={spots}
          />
        ) : game.status === 'filling' ? (
          <JoinPanel
            gameId={id}
            totalPence={share + PLAYER_FEE_PENCE}
            isLoggedIn={!!user}
            joinedAsUser={viewerJoined}
          />
        ) : viewerJoined && game.status === 'full' ? (
          <JoinPanel gameId={id} totalPence={share + PLAYER_FEE_PENCE} isLoggedIn joinedAsUser leaveOnly />
        ) : null}
      </main>
    </>
  )
}
