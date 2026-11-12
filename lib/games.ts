// Shared helpers for organiser-run games.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

// Stripe card holds last 7 days (Visa merchant-initiated can be 5), so a game
// can only be created this many days ahead. Players join after creation, so
// their hold is always younger than the game's lead time.
export const MAX_DAYS_AHEAD = 6

// Once every spot is paid for, the organiser has this long to book the pitch.
export const CONFIRM_WINDOW_HOURS = 24

export interface GameRow {
  id: string
  status: 'filling' | 'full' | 'confirmed' | 'cancelled' | 'payment_failed' | 'expired'
  game_kind: 'venue' | 'organiser'
  organiser_id: string | null
  organiser_name: string | null
  organiser_plays: boolean
  title: string | null
  venue_name: string | null
  game_date: string | null // YYYY-MM-DD
  start_time: string | null // HH:MM:SS
  total_cost_pence: number | null
  max_players: number | null
  share_pence: number | null
  full_at: string | null
}

export const GAME_COLS =
  'id, status, game_kind, organiser_id, organiser_name, organiser_plays, title, venue_name, game_date, start_time, total_cost_pence, max_players, share_pence, full_at'

// Number of spots other people pay for. If the organiser plays, their own
// share is settled outside the app, so one fewer spot is collected.
export function paidSpots(game: Pick<GameRow, 'max_players' | 'organiser_plays'>): number {
  const max = game.max_players ?? 0
  return Math.max(1, game.organiser_plays ? max - 1 : max)
}

export function sharePence(totalPence: number, players: number): number {
  return Math.ceil(totalPence / players)
}

export function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

// Today's date in London as YYYY-MM-DD.
export function londonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now)
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Kick-off as a real instant. Treats the stored date+time as London local time.
export function kickoffMs(date: string, time: string): number {
  const hhmm = time.slice(0, 5)
  // Build the instant for London local time by probing the UTC offset on that date.
  const guess = new Date(`${date}T${hhmm}:00Z`)
  const londonStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(guess)
  const [lh, lm] = londonStr.split(':').map(Number)
  const [gh, gm] = hhmm.split(':').map(Number)
  const offsetMin = (lh * 60 + lm) - (gh * 60 + gm)
  return guess.getTime() - offsetMin * 60_000
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
export function formatTime(t: string): string {
  return t.slice(0, 5)
}
