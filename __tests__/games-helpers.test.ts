import { describe, it, expect } from 'vitest'
import { addDays, kickoffMs, paidSpots, pounds, sharePence } from '@/lib/games'

describe('sharePence', () => {
  it('rounds up so the organiser is never short', () => {
    expect(sharePence(5000, 10)).toBe(500)
    expect(sharePence(5000, 7)).toBe(715) // 714.28 -> 715
    expect(sharePence(4550, 10)).toBe(455)
  })
})

describe('paidSpots', () => {
  it('leaves out the organiser when they play', () => {
    expect(paidSpots({ max_players: 10, organiser_plays: true })).toBe(9)
    expect(paidSpots({ max_players: 10, organiser_plays: false })).toBe(10)
  })
  it('never drops below one paying spot', () => {
    expect(paidSpots({ max_players: 1, organiser_plays: true })).toBe(1)
  })
})

describe('pounds', () => {
  it('formats pence', () => {
    expect(pounds(579)).toBe('£5.79')
    expect(pounds(500)).toBe('£5.00')
  })
})

describe('addDays', () => {
  it('rolls over month boundaries', () => {
    expect(addDays('2026-11-28', 6)).toBe('2026-12-04')
  })
})

describe('kickoffMs', () => {
  it('treats the time as London local time (winter = UTC)', () => {
    expect(new Date(kickoffMs('2026-12-10', '19:00')).toISOString()).toBe('2026-12-10T19:00:00.000Z')
  })
  it('treats the time as London local time (summer = UTC+1)', () => {
    expect(new Date(kickoffMs('2026-07-10', '19:00')).toISOString()).toBe('2026-07-10T18:00:00.000Z')
  })
})
