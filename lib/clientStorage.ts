'use client'

// Guest identity (name/phone) cached in localStorage so returning guests don't
// have to re-type their details. This is PII sitting in plaintext client
// storage, so every entry carries a `savedAt` timestamp and is treated as gone
// once it's older than PII_TTL_MS — read paths prune/delete expired data
// instead of returning it.

export const PII_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isFresh(savedAt: unknown): boolean {
  return typeof savedAt === 'number' && Number.isFinite(savedAt) && Date.now() - savedAt <= PII_TTL_MS
}

const PLAYER_DETAILS_KEY = 'bmp_player_details'
const MY_SESSIONS_KEY = 'bmp_my_sessions'

export interface StoredPlayerDetails {
  name: string
  phone: string
}

export function readPlayerDetails(): StoredPlayerDetails | null {
  try {
    const raw = localStorage.getItem(PLAYER_DETAILS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as (StoredPlayerDetails & { savedAt?: number }) | null
    if (!parsed || !isFresh(parsed.savedAt)) {
      localStorage.removeItem(PLAYER_DETAILS_KEY)
      return null
    }
    return { name: parsed.name, phone: parsed.phone }
  } catch {
    localStorage.removeItem(PLAYER_DETAILS_KEY)
    return null
  }
}

export function writePlayerDetails(name: string, phone: string): void {
  localStorage.setItem(PLAYER_DETAILS_KEY, JSON.stringify({ name, phone, savedAt: Date.now() }))
}

export interface StoredSessionPlayer {
  name: string
  phone: string
  joinedAt: string
}

export function readSessionPlayer(sessionId: string): StoredSessionPlayer | null {
  const key = `bmp_player_${sessionId}`
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as (StoredSessionPlayer & { savedAt?: number }) | null
    if (!parsed || !isFresh(parsed.savedAt)) {
      localStorage.removeItem(key)
      return null
    }
    return { name: parsed.name, phone: parsed.phone, joinedAt: parsed.joinedAt }
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function writeSessionPlayer(sessionId: string, name: string, phone: string): void {
  localStorage.setItem(`bmp_player_${sessionId}`, JSON.stringify({
    name,
    phone,
    joinedAt: new Date().toISOString(),
    savedAt: Date.now(),
  }))
}

export function removeSessionPlayer(sessionId: string): void {
  localStorage.removeItem(`bmp_player_${sessionId}`)
}

export interface StoredMySession {
  sessionId: string
  name: string
}

type RawMySession = StoredMySession & { savedAt?: number }

// Internal — keeps each entry's own savedAt so touching one session doesn't
// reset the expiry clock on unrelated ones.
function readMySessionsRaw(): (StoredMySession & { savedAt: number })[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MY_SESSIONS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    const fresh = (raw as RawMySession[]).filter((entry): entry is StoredMySession & { savedAt: number } => isFresh(entry?.savedAt))
    // Persist the pruned list so expired entries don't linger in storage.
    if (fresh.length !== raw.length) {
      localStorage.setItem(MY_SESSIONS_KEY, JSON.stringify(fresh))
    }
    return fresh
  } catch {
    return []
  }
}

export function readMySessions(): StoredMySession[] {
  return readMySessionsRaw().map(({ sessionId, name }) => ({ sessionId, name }))
}

export function upsertMySession(sessionId: string, name: string): void {
  const raw = readMySessionsRaw().filter(s => s.sessionId !== sessionId)
  raw.push({ sessionId, name, savedAt: Date.now() })
  localStorage.setItem(MY_SESSIONS_KEY, JSON.stringify(raw))
}

export function removeMySession(sessionId: string): void {
  const raw = readMySessionsRaw().filter(s => s.sessionId !== sessionId)
  localStorage.setItem(MY_SESSIONS_KEY, JSON.stringify(raw))
}
