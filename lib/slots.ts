export type SlotType = 'offpeak' | 'peak' | 'weekend'

export interface Pitch {
  id: string
  name: string
  format: string
  surface: string
  max_players: number
  peak_price: number
  offpeak_price: number
  weekend_price: number
}

export interface SlotTemplate {
  startTime: string
  endTime: string
  type: SlotType
}

// Globe Pitch slot schedule — fixed hourly time boundaries per weekday/weekend.
// Pricing tier (offpeak/peak/weekend) is a property of the time-of-day, not
// per-row state — actual £ pricing comes from the pitch (see priceForSlotType).
const WEEKDAY_SLOTS: SlotTemplate[] = [
  { startTime: '15:30', endTime: '16:30', type: 'offpeak' },
  { startTime: '16:30', endTime: '17:30', type: 'offpeak' },
  { startTime: '17:30', endTime: '18:30', type: 'offpeak' },
  { startTime: '18:30', endTime: '19:30', type: 'peak' },
  { startTime: '19:30', endTime: '20:30', type: 'peak' },
  { startTime: '20:30', endTime: '21:30', type: 'peak' },
]

const WEEKEND_SLOTS: SlotTemplate[] = [
  { startTime: '09:30', endTime: '10:30', type: 'weekend' },
  { startTime: '10:30', endTime: '11:30', type: 'weekend' },
  { startTime: '11:30', endTime: '12:30', type: 'weekend' },
  { startTime: '12:30', endTime: '13:30', type: 'weekend' },
  { startTime: '13:30', endTime: '14:30', type: 'weekend' },
  { startTime: '14:30', endTime: '15:30', type: 'weekend' },
  { startTime: '15:30', endTime: '16:30', type: 'weekend' },
  { startTime: '16:30', endTime: '17:30', type: 'weekend' },
  { startTime: '17:30', endTime: '18:30', type: 'weekend' },
  { startTime: '18:30', endTime: '19:30', type: 'peak' },
  { startTime: '19:30', endTime: '20:30', type: 'peak' },
  { startTime: '20:30', endTime: '21:30', type: 'peak' },
]

export function getSlotsForDay(date: Date): SlotTemplate[] {
  const day = date.getDay() // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? WEEKEND_SLOTS : WEEKDAY_SLOTS
}

// `slots.type` was removed from the DB in the pitches migration — pricing tier
// is a fixed property of the time-of-day/weekday schedule, so it's recomputed
// from date+start_time here instead of being stored per row.
export function getSlotType(dateStr: string, startTime: string): SlotType {
  const d = new Date(`${dateStr}T12:00:00`)
  const hhmm = startTime.slice(0, 5)
  const match = getSlotsForDay(d).find(t => t.startTime === hhmm)
  return match?.type ?? 'offpeak'
}

export function formatSlotType(type: SlotType): string {
  switch (type) {
    case 'offpeak': return 'Off-peak'
    case 'peak':    return 'Peak'
    case 'weekend': return 'Weekend'
  }
}

export function priceForSlotType(pitch: Pick<Pitch, 'peak_price' | 'offpeak_price' | 'weekend_price'>, type: SlotType): number {
  switch (type) {
    case 'peak':    return pitch.peak_price
    case 'weekend': return pitch.weekend_price
    case 'offpeak': return pitch.offpeak_price
  }
}

export function formatPrice(gbp: number): string {
  return `£${gbp.toFixed(2).replace('.00', '')}`
}

export function formatPerPlayer(pitchPrice: number, maxPlayers: number): string {
  return `£${(pitchPrice / maxPlayers).toFixed(2)}`
}

// ── Multi-hour slot combining ──────────────────────────────────────────────
// A multi-hour booking (60/120/180 min) spans several consecutive hourly slot
// rows. These helpers combine them into one logical time range + total price
// so every page that displays a session's slot can stay unaware of whether
// it's a 60-minute or multi-hour booking.
export interface CombinableSlot {
  id: string
  date: string
  start_time: string
  end_time: string
  price: number
  pitches: Pitch
}

export interface CombinedSlotInfo<T extends CombinableSlot> {
  ids: string[]
  date: string
  start_time: string
  end_time: string
  price: number
  pitches: Pitch
  first: T
  last: T
}

export function combineSlots<T extends CombinableSlot>(slots: T[]): CombinedSlotInfo<T> {
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return {
    ids: sorted.map(s => s.id),
    date: first.date,
    start_time: first.start_time,
    end_time: last.end_time,
    price: sorted.reduce((sum, s) => sum + s.price, 0),
    pitches: first.pitches,
    first,
    last,
  }
}
