import { createServiceClient } from '@/lib/supabase/service'

// Flips a stale 'filling' session (whose slot's start time has already
// passed) to 'expired'. No-op if the session isn't actually stale, or has
// already moved past 'filling' (confirmed/cancelled/expired) — the
// `.eq('status', 'filling')` guard prevents racing with a concurrent confirm.
//
// Kept distinct from 'cancelled' (used when a rival group confirms the slot
// first) so My Bookings can keep showing genuine cancellations to players
// while a game that simply never filled in time quietly drops out of view —
// nothing queries for 'expired' sessions anywhere in the app.
export async function expireIfStale(sessionId: string, slotDate: string, slotStartTime: string): Promise<boolean> {
  const slotTime = new Date(`${slotDate}T${slotStartTime}`).getTime()
  // A malformed/missing date can never be confidently called "in the past" —
  // treat it as not stale rather than risk expiring a session incorrectly.
  if (!Number.isFinite(slotTime) || slotTime > Date.now()) return false

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sessions')
    .update({ status: 'expired' })
    .eq('id', sessionId)
    .eq('status', 'filling')
    .select('id')

  return (data?.length ?? 0) > 0
}
