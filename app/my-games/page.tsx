import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { GAME_COLS, GameRow, formatGameDate, formatTime } from '@/lib/games'
import Nav from '@/components/Nav'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  filling: 'Filling',
  full: 'Full, waiting on organiser',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  expired: 'Passed',
}

export default async function MyGamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/my-games')

  const svc = createServiceClient()
  const { data: organised } = await svc
    .from('sessions')
    .select(GAME_COLS)
    .eq('game_kind', 'organiser')
    .eq('organiser_id', user.id)
    .order('game_date', { ascending: false })
    .limit(50)

  const { data: joinedRows } = await svc.from('players').select('session_id').eq('user_id', user.id)
  const joinedIds = (joinedRows ?? []).map(r => r.session_id as string)
  const { data: joined } = joinedIds.length
    ? await svc.from('sessions').select(GAME_COLS).eq('game_kind', 'organiser').in('id', joinedIds).order('game_date', { ascending: false })
    : { data: [] }

  const render = (g: GameRow) => (
    <Link
      key={g.id}
      href={`/game/${g.id}`}
      style={{ display: 'block', textDecoration: 'none', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', marginBottom: '10px' }}
    >
      <div style={{ fontWeight: 700, fontSize: '16px' }}>{g.title ?? 'Football'}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>
        {g.venue_name}, {formatGameDate(g.game_date!)} {formatTime(g.start_time!)}
      </div>
      <div style={{ color: 'var(--green)', fontSize: '13px', fontWeight: 600, marginTop: '6px' }}>{STATUS_LABEL[g.status] ?? g.status}</div>
    </Link>
  )

  const organisedGames = (organised ?? []) as GameRow[]
  const joinedGames = ((joined ?? []) as GameRow[]).filter(g => g.organiser_id !== user.id)

  return (
    <>
      <Nav />
      <main style={{ maxWidth: '560px', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        <h1 style={{ fontSize: 'var(--text-h2)', letterSpacing: '-0.03em', marginBottom: '1.5rem' }}>My games</h1>

        <h2 style={{ fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Organising</h2>
        {organisedGames.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Nothing yet. <Link href="/create" style={{ color: 'var(--green)' }}>Create a game</Link>.
          </p>
        ) : organisedGames.map(render)}

        <h2 style={{ fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '1.75rem 0 0.75rem' }}>Playing in</h2>
        {joinedGames.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Games you join while signed in show up here.</p>
        ) : joinedGames.map(render)}
      </main>
    </>
  )
}
