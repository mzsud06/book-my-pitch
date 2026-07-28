-- BookMyPitch database schema
-- Run this in Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Venues
create table if not exists venues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  stripe_account_id text,
  owner_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Pitches (a bookable playing surface at a venue — a venue may have several)
create table if not exists pitches (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade not null,
  name text not null,
  format text not null, -- e.g. '5-a-side', '7-a-side'
  surface text default '4G',
  max_players integer not null,
  peak_price integer not null,    -- in GBP, whole pounds
  offpeak_price integer not null,
  weekend_price integer not null,
  created_at timestamptz default now()
);

-- Slots (each bookable time period)
-- Pricing tier (offpeak/peak/weekend) is derived from date+start_time at the
-- application layer (see lib/slots.ts:getSlotType) rather than stored here —
-- price/max_players/format below are seeded from the linked pitch at slot
-- creation time and denormalized for fast reads.
create table if not exists slots (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  pitch_id uuid references pitches(id),
  date date not null,
  start_time time not null,
  end_time time not null,
  format text default '5-a-side',
  price integer not null, -- in GBP (whole pounds, e.g. 45 = £45)
  max_players integer not null default 10,
  created_at timestamptz default now(),
  -- pitch_id is part of the uniqueness so a venue with multiple pitches (e.g.
  -- a 5-a-side and a 7-a-side sharing the same time schedule) can each have
  -- their own slot row at the same date/time.
  unique (venue_id, pitch_id, date, start_time)
);

-- Sessions (a group's attempt to fill a slot)
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  slot_id uuid references slots(id) on delete cascade not null,
  organiser_id uuid references auth.users(id),
  organiser_name text,
  organiser_phone text,
  status text not null default 'filling' check (status in ('filling', 'confirmed', 'cancelled', 'payment_failed', 'expired')),
  created_at timestamptz default now()
);

-- Players (people who have joined a session)
create table if not exists players (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  name text not null,
  phone text,
  stripe_customer_id text,
  stripe_payment_method_id text not null,
  joined_at timestamptz default now()
);

-- Bookings (created when a session is confirmed)
create table if not exists bookings (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade not null,
  slot_id uuid references slots(id) not null,
  confirmed_at timestamptz not null
);

-- Messages (session chat, only after confirmation)
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  content text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table venues enable row level security;
alter table pitches enable row level security;
alter table slots enable row level security;
alter table sessions enable row level security;
alter table players enable row level security;
alter table bookings enable row level security;
alter table messages enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================

-- VENUES: anyone can read, only venue owners can write
create policy "Anyone can view venues" on venues
  for select using (true);
create policy "Owners can manage their venue" on venues
  for all using (auth.uid() = owner_id);

-- PITCHES: anyone can read, only venue owners can write
create policy "Anyone can view pitches" on pitches
  for select using (true);
create policy "Owners can manage their pitches" on pitches
  for all using (
    exists (select 1 from venues where id = venue_id and owner_id = auth.uid())
  );

-- SLOTS: anyone can read, owners manage via API (service role for seeding)
create policy "Anyone can view slots" on slots
  for select using (true);
create policy "Owners can manage slots" on slots
  for all using (
    exists (select 1 from venues where id = venue_id and owner_id = auth.uid())
  );
-- NOTE: slot seeding (SlotsPage upsert) uses service-role client which bypasses RLS.
-- No permissive anon INSERT policy — that would allow arbitrary slot injection.

-- SESSIONS: anyone can read
create policy "Anyone can view sessions" on sessions
  for select using (true);
-- Only authenticated users may create sessions, and organiser_id must match their uid.
-- This prevents unauthenticated direct inserts and stops users spoofing organiser_id.
create policy "Authenticated users can create sessions" on sessions
  for insert to authenticated
  with check (auth.uid() = organiser_id);
-- Updates and deletes are done exclusively by the service-role client (bypasses RLS).
-- No anon/authenticated UPDATE policy — prevents clients from changing session status
-- directly (e.g. setting status='confirmed' without going through payment flow).

-- PLAYERS: restricted column-level read, all writes via service-role only
-- Row-level: anyone can see player rows (for the session roster display)
create policy "Anyone can view players" on players
  for select using (true);
-- INSERT/UPDATE/DELETE are done exclusively by the service-role client (bypasses RLS).
-- No anon INSERT policy — prevents bypassing /api/join validation and Stripe setup.
-- No anon DELETE policy — prevents bypassing /api/leave and Stripe detach.

-- BOOKINGS: anyone can read
create policy "Anyone can view bookings" on bookings
  for select using (true);
-- INSERT is done exclusively by the service-role client after all payments succeed.

-- MESSAGES: anyone in the app can read and send messages
create policy "Anyone can view messages" on messages
  for select using (true);
create policy "Anyone can send messages" on messages
  for insert with check (true);

-- ============================================================
-- Column-level security on players
-- Revoke direct SELECT on sensitive payment columns from anon and authenticated roles.
-- The service_role bypasses all privileges and retains full access.
-- ============================================================
revoke select on players from anon, authenticated;
grant select (id, name, joined_at, session_id, user_id) on players to anon, authenticated;

-- Insert Globe Football Pitch venue (update owner_id after creating owner account)
insert into venues (name, address)
values ('Globe Football Pitch', '110 Globe Rd, Bethnal Green, London E1 4DZ')
on conflict do nothing;

-- Insert the pitch for that venue — slot seeding (app/slots/page.tsx) reads
-- pricing/max_players/format from here rather than hardcoding them.
insert into pitches (venue_id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price)
select id, 'Main Pitch', '5-a-side', '4G', 10, 50, 30, 40
from venues
where name = 'Globe Football Pitch'
on conflict do nothing;

-- Enable realtime for relevant tables
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table messages;
