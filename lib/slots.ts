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

// A venue's bookable hours and peak window — every venue used to share one
// hardcoded schedule (originally built for Globe Football Pitch); this makes
// it per-venue instead. Times are 'HH:MM'. Peak applies from peak_start_time
// until closing on both weekdays and weekends; before that it's off-peak on
// weekdays and the flat weekend rate on weekends.
export interface VenueSchedule {
  opening_time: string
  closing_time: string
  weekend_opening_time: string
  weekend_closing_time: string
  peak_start_time: string
}

// Matches the schedule every venue effectively had before this was
// configurable — used as a fallback so any caller that hasn't been updated
// with a real venue schedule yet keeps behaving exactly as before.
export const DEFAULT_SCHEDULE: VenueSchedule = {
  opening_time: '15:30',
  closing_time: '21:30',
  weekend_opening_time: '09:30',
  weekend_closing_time: '21:30',
  peak_start_time: '18:30',
}

// Pulls the schedule fields off a fetched venue row, falling back to
// DEFAULT_SCHEDULE for any field missing (e.g. a query that hasn't been
// updated to select the new columns yet).
export function scheduleFromVenue(venue: Partial<VenueSchedule> | null | undefined): VenueSchedule {
  return {
    opening_time: venue?.opening_time ?? DEFAULT_SCHEDULE.opening_time,
    closing_time: venue?.closing_time ?? DEFAULT_SCHEDULE.closing_time,
    weekend_opening_time: venue?.weekend_opening_time ?? DEFAULT_SCHEDULE.weekend_opening_time,
    weekend_closing_time: venue?.weekend_closing_time ?? DEFAULT_SCHEDULE.weekend_closing_time,
    peak_start_time: venue?.peak_start_time ?? DEFAULT_SCHEDULE.peak_start_time,
  }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export function getSlotsForDay(date: Date, schedule: VenueSchedule = DEFAULT_SCHEDULE): SlotTemplate[] {
  const day = date.getDay() // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6
  const open = timeToMinutes(isWeekend ? schedule.weekend_opening_time : schedule.opening_time)
  const close = timeToMinutes(isWeekend ? schedule.weekend_closing_time : schedule.closing_time)
  const peakStart = timeToMinutes(schedule.peak_start_time)

  const slots: SlotTemplate[] = []
  for (let t = open; t + 60 <= close; t += 60) {
    const type: SlotType = t >= peakStart ? 'peak' : (isWeekend ? 'weekend' : 'offpeak')
    slots.push({ startTime: minutesToTime(t), endTime: minutesToTime(t + 60), type })
  }
  return slots
}

// Derived from a venue's schedule so displayed opening hours can never drift
// out of sync with the actual bookable window.
export function getOpeningHours(schedule: VenueSchedule = DEFAULT_SCHEDULE) {
  return {
    weekday: { start: schedule.opening_time, end: schedule.closing_time },
    weekend: { start: schedule.weekend_opening_time, end: schedule.weekend_closing_time },
  }
}

// `slots.type` was removed from the DB in the pitches migration — pricing tier
// is a property of the time-of-day and the venue's own schedule, so it's
// recomputed from date+start_time here instead of being stored per row.
export function getSlotType(dateStr: string, startTime: string, schedule: VenueSchedule = DEFAULT_SCHEDULE): SlotType {
  const d = new Date(`${dateStr}T12:00:00`)
  const hhmm = startTime.slice(0, 5)
  const match = getSlotsForDay(d, schedule).find(t => t.startTime === hhmm)
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

// A 'filling' session whose slot start time has passed is stale even before
// anyone visits it (session page / join route only flip status on read).
// Pure date math — safe to import from client components too.
export function isSlotInPast(dateStr: string, startTime: string): boolean {
  return new Date(`${dateStr}T${startTime}`).getTime() < Date.now()
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
