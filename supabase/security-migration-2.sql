-- ============================================================
-- SECURITY MIGRATION 2 (corrected)
-- Run this in the Supabase SQL editor on the live project.
-- Safe to run multiple times (DROP/ADD IF EXISTS, REVOKE/GRANT are idempotent).
--
-- The original draft of this migration revoked column-level SELECT on
-- sessions (organiser_name, organiser_phone) and added a messages.sender_phone
-- column. Both were reverted:
--   - The sessions column revoke broke the session page, slots page,
--     my-bookings, and owner dashboard, which all read organiser_name /
--     organiser_phone via the anon/authenticated client. organiser_phone is
--     now handled entirely in app code instead: fetched server-side only and
--     passed down as a prop, never re-queried from the browser client.
--   - messages.sender_phone would have exposed guest phone numbers to any
--     realtime subscriber. Guest chat eligibility is now checked server-side
--     in /api/send-message (service-role client, bypasses RLS) instead of
--     via a client-supplied phone column.
-- ============================================================

-- ============================================================
-- 1. SESSIONS — scoped UPDATE policy for organisers
-- ============================================================
-- No UPDATE policy existed for anon/authenticated after the old permissive
-- "Service role can update sessions" (using(true)) policy was dropped, so
-- organiser self-service actions from the browser (toggle public, save team
-- name, convert game type) were silently no-ops. This adds a policy scoped to
-- the organiser, restricted at the column level to the fields the browser
-- client actually needs to touch — status, organiser_id, organiser_phone,
-- organiser_name and slot_id are deliberately excluded so an organiser can't
-- set status = 'confirmed' directly and skip payment, or reassign the
-- session to someone else.
create policy "Organisers can update their own sessions" on sessions
  for update to authenticated
  using (auth.uid() = organiser_id)
  with check (auth.uid() = organiser_id);

revoke update on sessions from anon, authenticated;
grant update (is_public, team_name, game_type, matched_session_id) on sessions to authenticated;

-- ============================================================
-- 2. MESSAGES — tighten INSERT policy (no sender_phone column)
-- ============================================================
-- The original "Anyone can send messages" policy used with_check(true),
-- which let any anon/authenticated client insert a message into ANY
-- session's chat (not just ones they're part of) with a spoofable user_id.
drop policy if exists "Anyone can send messages" on messages;

-- Authenticated members only: the inserted row's user_id must be the
-- caller's own uid, AND that uid must actually have a player row in this
-- session. There is deliberately no guest INSERT policy — guest messages go
-- through /api/send-message, which verifies the guest's phone against their
-- player row server-side and inserts via the service-role client (bypasses
-- RLS entirely, so no guest-facing policy or sender_phone column is needed).
create policy "Members can send messages" on messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from players
      where players.session_id = messages.session_id
        and players.user_id = auth.uid()
    )
  );

-- Verify the resulting policy state (optional — remove before saving to repo):
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
