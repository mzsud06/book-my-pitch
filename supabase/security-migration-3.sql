-- ============================================================
-- SECURITY MIGRATION 3 — reconciles security-migration.sql and
-- security-migration-2.sql with the live project (both were only
-- partially applied), plus a new fix for pitches.
-- Run this in the Supabase SQL editor on the live project.
-- Idempotent: safe to re-run.
-- ============================================================

-- ============================================================
-- 1. SESSIONS — drop leftover permissive policies from before the
--    earlier security migrations (never actually dropped on the live
--    project, so they were still granting anon/authenticated full
--    row-level access alongside the newer restrictive policies)
-- ============================================================
drop policy if exists "Service role can update sessions" on sessions;
drop policy if exists "Anyone can create sessions" on sessions;

drop policy if exists "Authenticated users can create sessions" on sessions;
create policy "Authenticated users can create sessions" on sessions
  for insert to authenticated
  with check (auth.uid() = organiser_id);

drop policy if exists "Organisers can update their own sessions" on sessions;
create policy "Organisers can update their own sessions" on sessions
  for update to authenticated
  using (auth.uid() = organiser_id)
  with check (auth.uid() = organiser_id);

revoke update on sessions from anon, authenticated;
grant update (is_public, team_name, game_type, matched_session_id) on sessions to authenticated;

-- ============================================================
-- 2. PLAYERS — remove direct INSERT, restrict SELECT to non-sensitive
--    columns (phone, stripe_customer_id, stripe_payment_method_id were
--    readable by anyone with the anon key)
-- ============================================================
drop policy if exists "Anyone can join a session" on players;

revoke select on players from anon, authenticated;
grant select (id, name, joined_at, session_id, user_id) on players to anon, authenticated;

-- ============================================================
-- 3. BOOKINGS — remove direct INSERT (bookings are created server-side
--    after payment via the service-role client)
-- ============================================================
drop policy if exists "Service role can create bookings" on bookings;

-- ============================================================
-- 4. SLOTS — remove permissive anon INSERT (slot seeding uses the
--    service-role client)
-- ============================================================
drop policy if exists "Service role can insert slots" on slots;

-- ============================================================
-- 5. NOTIFICATIONS — remove permissive anon INSERT (notifications are
--    created server-side via the service-role client)
-- ============================================================
drop policy if exists "Service role can insert notifications" on notifications;

-- ============================================================
-- 6. MESSAGES — tighten INSERT policy; guest messages go through
--    /api/send-message (service-role client, verifies guest phone
--    server-side)
-- ============================================================
drop policy if exists "Anyone can send messages" on messages;
drop policy if exists "Members can send messages" on messages;
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

-- ============================================================
-- 7. PITCHES — replace open ALL(true) policy with venue-owner-scoped
--    policy, matching the existing "Owners can manage slots" /
--    "Owners can manage their venue" pattern. Not covered by either
--    prior security migration — pitches were fully open to anon/
--    authenticated (INSERT/UPDATE/DELETE any row).
-- ============================================================
drop policy if exists "Service role can manage pitches" on pitches;
create policy "Owners can manage their pitches" on pitches
  for all
  using (exists (select 1 from venues where venues.id = pitches.venue_id and venues.owner_id = auth.uid()));

-- Verify the resulting policy state (optional — remove before saving to repo):
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
