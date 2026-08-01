-- ============================================================
-- VENUE SCHEDULE MIGRATION
-- Run this in the Supabase SQL editor on the live project.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- Peak/off-peak/weekend time boundaries used to be hardcoded globally in
-- lib/slots.ts (originally built for Globe Football Pitch) — every venue got
-- the exact same opening hours and peak window with no way to change it.
-- These columns let each venue set its own. Defaults below exactly match the
-- old hardcoded schedule, so every existing venue (Globe, Mulberry) keeps
-- behaving identically without a backfill step.
alter table venues add column if not exists opening_time time not null default '15:30';
alter table venues add column if not exists closing_time time not null default '21:30';
alter table venues add column if not exists weekend_opening_time time not null default '09:30';
alter table venues add column if not exists weekend_closing_time time not null default '21:30';
alter table venues add column if not exists peak_start_time time not null default '18:30';
