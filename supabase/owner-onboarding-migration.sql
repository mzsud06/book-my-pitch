-- ============================================================
-- OWNER ONBOARDING MIGRATION
-- Run this in the Supabase SQL editor on the live project.
-- Safe to run multiple times (IF NOT EXISTS / idempotent UPDATE).
-- ============================================================

-- ============================================================
-- 1. VENUES — track whether Stripe Connect onboarding is actually done
-- ============================================================
-- A venue can have a stripe_account_id (the Connect account exists) long
-- before Stripe has verified it (identity, bank details) and set
-- charges_enabled = true. triggerPayments must never attempt a
-- transfer_data.destination charge against an account that isn't verified
-- yet — that fails for every player in the group at once. This column is the
-- gate: only set true once the owner dashboard confirms
-- stripe.accounts.retrieve(...).charges_enabled via a live Stripe check.
alter table venues add column if not exists stripe_onboarding_complete boolean not null default false;

-- Backfill: any venue that already has a stripe_account_id was onboarded
-- manually before this column existed (e.g. Globe Football Pitch) and is
-- already taking live payments — treat it as complete so it doesn't
-- disappear from the venue listing.
update venues set stripe_onboarding_complete = true
where stripe_account_id is not null and stripe_onboarding_complete = false;

-- ============================================================
-- 2. VENUES — founder approval gate
-- ============================================================
-- Stripe verifies that the OWNER is a real, identity-checked person — it
-- says nothing about whether the VENUE itself is real. Self-serve signup
-- alone would let anyone list a fake pitch, collect real payments the
-- moment a group fills a slot, and leave players showing up to nothing.
-- This column is a manual human checkpoint: a venue only becomes bookable
-- once BOTH stripe_onboarding_complete AND admin_approved are true
-- (enforced in app/api/sessions/route.ts, app/slots/page.tsx,
-- app/slots/[venueId]/page.tsx, and lib/triggerPayments.ts).
alter table venues add column if not exists admin_approved boolean not null default false;

-- Backfill: Globe Football Pitch is the venue you already personally
-- vetted and is already live — approve it so it doesn't disappear.
update venues set admin_approved = true
where stripe_account_id is not null and admin_approved = false;

-- ============================================================
-- To approve a new venue after you've personally checked it out, run:
--   update venues set admin_approved = true where name = 'THEIR VENUE NAME';
-- (or `where id = '...'` if you have the venue's id)
-- ============================================================
