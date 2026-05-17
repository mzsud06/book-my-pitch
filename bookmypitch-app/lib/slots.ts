export type SlotType = 'offpeak' | 'peak' | 'weekend'

export interface SlotTemplate {
  startTime: string
  endTime: string
  type: SlotType
  priceGBP: number
  maxPlayers: number
}

// Globe Pitch slot schedule
const WEEKDAY_SLOTS: SlotTemplate[] = [
  { startTime: '15:30', endTime: '16:30', type: 'offpeak', priceGBP: 25, maxPlayers: 10 },
  { startTime: '16:30', endTime: '17:30', type: 'offpeak', priceGBP: 25, maxPlayers: 10 },
  { startTime: '17:30', endTime: '18:30', type: 'offpeak', priceGBP: 25, maxPlayers: 10 },
  { startTime: '18:30', endTime: '19:30', type: 'peak',    priceGBP: 45, maxPlayers: 10 },
  { startTime: '19:30', endTime: '20:30', type: 'peak',    priceGBP: 45, maxPlayers: 10 },
  { startTime: '20:30', endTime: '21:30', type: 'peak',    priceGBP: 45, maxPlayers: 10 },
]

const WEEKEND_SLOTS: SlotTemplate[] = [
  { startTime: '09:30', endTime: '10:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '10:30', endTime: '11:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '11:30', endTime: '12:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '12:30', endTime: '13:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '13:30', endTime: '14:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '14:30', endTime: '15:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '15:30', endTime: '16:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '16:30', endTime: '17:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '17:30', endTime: '18:30', type: 'weekend', priceGBP: 35, maxPlayers: 10 },
  { startTime: '18:30', endTime: '19:30', type: 'peak',    priceGBP: 45, maxPlayers: 10 },
  { startTime: '19:30', endTime: '20:30', type: 'peak',    priceGBP: 45, maxPlayers: 10 },
  { startTime: '20:30', endTime: '21:30', type: 'peak',    priceGBP: 45, maxPlayers: 10 },
]

export function getSlotsForDay(date: Date): SlotTemplate[] {
  const day = date.getDay() // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? WEEKEND_SLOTS : WEEKDAY_SLOTS
}

export function formatSlotType(type: SlotType): string {
  switch (type) {
    case 'offpeak': return 'Off-peak'
    case 'peak':    return 'Peak'
    case 'weekend': return 'Weekend'
  }
}

export function perPlayerCost(pitchPrice: number, maxPlayers: number = 10): number {
  return pitchPrice / maxPlayers
}

export function formatPrice(gbp: number): string {
  return `£${gbp.toFixed(2).replace('.00', '')}`
}

export function formatPerPlayer(pitchPrice: number): string {
  const pp = pitchPrice / 10
  return `£${pp.toFixed(2)}`
}
