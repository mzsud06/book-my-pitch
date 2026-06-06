-- ============================================================
-- SECURITY MIGRATION
-- Run this in the Supabase SQL editor on the live project.
-- Safe to run multiple times (DROP IF EXISTS / CREATE OR REPLACE).
-- ============================================================

-- ============================================================
-- 1. SESSIONS — drop the misconfigured UPDATE policy
-- ============================================================
-- The original "Service role can update sessions" policy used USING(true),
-- which allowed ANY anon/authenticated client to update session status directly
-- (e.g. set status='confirmed' without going through the payment flow).
-- The service_role client bypasses RLS entirely, so this policy was not needed
-- by any legitimate server-side code — only an attack surface.
drop policy if exists "Service role can update sessions" on sessions;

-- ============================================================
-- 2. SESSIONS — replace permissive INSERT with auth-scoped INSERT
-- ============================================================
-- The original "Anyone can create sessions" allowed unauthenticated direct inserts.
-- The new policy requires the caller to be authenticated and forces organiser_id
-- to match the calling user's uid, preventing spoofing.
drop policy if exists "Anyone can create sessions" on sessions;

create policy "Authenticated users can create sessions" on sessions
  for insert to authenticated
  with check (auth.uid() = organiser_id);

-- ============================================================
-- 3. PLAYERS — remove direct INSERT policy
-- ============================================================
-- The original "Anyone can join a session" allowed any client to insert player rows
-- directly, bypassing /api/join validation, Stripe setup, and duplicate checks.
-- All player inserts now go through the service-role API route.
drop policy if exists "Anyone can join a session" on players;

-- ============================================================
-- 4. BOOKINGS — remove direct INSERT policy
-- ============================================================
-- The original "Service role can create bookings" used WITH CHECK(true), which
-- allowed any anon/auth client to create booking records directly.
-- Bookings are created exclusively by the service-role client after payment.
drop policy if exists "Service role can create bookings" on bookings;

-- ============================================================
-- 5. SLOTS — remove permissive anon INSERT policy
-- ============================================================
-- The original "Service role can insert slots" used WITH CHECK(true), allowing
-- any client to inject arbitrary slots. Slot seeding now uses the service-role
-- client in SlotsPage which bypasses RLS, so this policy is not needed.
drop policy if exists "Service role can insert slots" on slots;

-- ============================================================
-- 6. PLAYERS — column-level security
-- ============================================================
-- The anon/authenticated roles currently have SELECT on ALL columns, exposing
-- phone, stripe_customer_id, and stripe_payment_method_id to any client
-- with the anon key. Revoke and re-grant only safe columns.
-- The service_role retains full access (bypasses column-level privileges too).
revoke select on players from anon, authenticated;
grant select (id, name, joined_at, session_id, user_id) on players to anon, authenticated;

-- Verify the resulting policy state (optional — remove before saving to repo):
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
