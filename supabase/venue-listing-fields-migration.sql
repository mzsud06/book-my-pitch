-- ============================================================
-- VENUE LISTING FIELDS MIGRATION
-- Run this in the Supabase SQL editor on the live project.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- Optional per-weekday hours override — a venue only sets this if it ticks
-- "hours differ by day" at signup; otherwise it stays null and the existing
-- weekday/weekend columns apply as before (see lib/slots.ts:getSlotsForDay).
alter table venues add column if not exists daily_hours jsonb;

-- Operational contact number for booking issues — informational only, not
-- read by any booking/payment logic.
alter table venues add column if not exists contact_phone text;

-- Facility tags shown on the venue's public listing (floodlights, parking,
-- changing rooms, etc).
alter table venues add column if not exists amenities text[] not null default '{}';

-- Minutes of notice required before kickoff for a slot to still be
-- bookable — enforced in app/api/sessions/route.ts. Defaults to 0 (no
-- minimum) so existing venues (Globe, Mulberry) are unaffected.
alter table venues add column if not exists min_booking_notice_minutes integer not null default 0;
