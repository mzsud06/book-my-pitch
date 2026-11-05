// Display-only label helpers.

/** "4G" -> "4G artificial grass"; anything else unchanged. */
export function surfaceLabel(surface: string | undefined | null): string {
  if (!surface) return ''
  const s = surface.trim()
  return /^[34]g$/i.test(s) ? `${s.toUpperCase()} artificial grass` : s
}

/** Short form for badges: "Artificial grass", "Grass", "Indoor". */
export function surfaceShort(surface: string | undefined | null): string {
  if (!surface) return ''
  const s = surface.trim()
  return /^[34]g$/i.test(s) ? 'Artificial grass' : s.charAt(0).toUpperCase() + s.slice(1)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-06" -> "Fri 6 Nov" */
export function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
