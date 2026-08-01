-- BookMyPitch database schema
-- Snapshot of the live Supabase schema, for documentation only.
-- Do not run this against the live project — tables already exist there.
-- If you need a fresh project, run this once in the Supabase SQL editor.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Venues
create table if not exists venues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  stripe_account_id text,
  owner_id uuid references auth.users(id),
  created_at timestamptz default now(),
  -- Stripe reports charges_enabled once identity/bank verification is done —
  -- see app/owner/dashboard/page.tsx, which self-heals this flag on load.
  stripe_onboarding_complete boolean not null default false,
  -- A human reviews every new venue before it's bookable — see
  -- app/api/sessions/route.ts, which refuses to create a session otherwise.
  admin_approved boolean not null default false,
  -- This venue's own bookable hours and peak-price window (see
  -- lib/slots.ts:getSlotsForDay/getSlotType) — every venue used to share one
  -- hardcoded schedule originally built for Globe Football Pitch; these
  -- columns let each venue set its own, collected at signup.
  opening_time time not null default '15:30',
  closing_time time not null default '21:30',
  weekend_opening_time time not null default '09:30',
  weekend_closing_time time not null default '21:30',
  peak_start_time time not null default '18:30'
);

-- Pitches (a bookable playing surface at a venue — a venue may have several)
create table if not exists pitches (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade not null,
  name text not null,
  format text not null check (format in ('5-a-side', '7-a-side', '11-a-side')),
  surface text default '4G',
  max_players integer not null,
  peak_price integer not null,    -- in GBP, whole pounds
  offpeak_price integer not null,
  weekend_price integer not null,
  created_at timestamptz default now()
);

-- Slots (each bookable time period)
-- Pricing tier (offpeak/peak/weekend) is derived from date+start_time and the
-- owning venue's schedule columns above at the application layer (see
-- lib/slots.ts:getSlotType) rather than stored here — price/max_players/format
-- below are seeded from the linked pitch at slot creation time and
-- denormalized for fast reads.
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
  created_at timestamptz default now(),
  -- Multi-hour (60/120/180 min) bookings span several consecutive slot rows —
  -- the full list lives here; slot_id above stays the first/primary one.
  slot_ids uuid[] default '{}',
  -- 'private': invite-only via share link. 'open': publicly discoverable,
  -- requires a logged-in account to join. Only these two values are
  -- reachable from current application code (see app/api/sessions/route.ts).
  game_type text default 'private' check (game_type in ('private', 'open')),
  -- Set true once an organiser converts a private game to open — gates the
  -- "Public sessions are readable by anyone" policy below. One-way in the
  -- app (no UI path back to private).
  is_public boolean default false,
  -- Reserved for future opponent-matching; not written by any current route.
  matched_session_id uuid references sessions(id),
  team_name text
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

-- Messages (session chat)
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  content text not null,
  created_at timestamptz default now(),
  -- Resolved server-side from the sender's verified player row at insert
  -- time (see app/api/send-message/route.ts) — never trusted from the client.
  sender_name text,
  sender_phone text
);

-- Notifications (per-user activity feed — shown in the Nav bell)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  session_id uuid references sessions(id) on delete cascade,
  message text not null,
  read boolean default false,
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
alter table notifications enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================

-- VENUES: anyone can read, only venue owners can write
create policy "Anyone can view venues" on venues
  for select using (true);
create policy "Owners can manage their venue" on venues
  for all using (auth.uid() = owner_id);

-- PITCHES: anyone can read, only the owning venue's owner can write
create policy "Anyone can view pitches" on pitches
  for select using (true);
create policy "Owners can manage their pitches" on pitches
  for all using (
    exists (select 1 from venues where venues.id = pitches.venue_id and venues.owner_id = auth.uid())
  );

-- SLOTS: anyone can read, owners manage via API (service role for seeding)
create policy "Anyone can view slots" on slots
  for select using (true);
create policy "Owners can manage slots" on slots
  for all using (
    exists (select 1 from venues where venues.id = slots.venue_id and venues.owner_id = auth.uid())
  );
-- NOTE: slot seeding (lib/seedSlots.ts) uses the service-role client, which
-- bypasses RLS. No permissive anon INSERT policy — that would allow
-- arbitrary slot injection.

-- SESSIONS
create policy "Anyone can view sessions" on sessions
  for select using (true);
-- Redundant with the policy above (both permit true), but is the actual
-- live policy scoped to anon specifically for public/open games.
create policy "Public sessions are readable by anyone" on sessions
  for select to anon
  using (is_public = true and matched_session_id is null and status = 'filling');
-- Only authenticated users may create sessions, and organiser_id must match
-- their uid — prevents unauthenticated direct inserts and organiser spoofing.
create policy "Authenticated users can create sessions" on sessions
  for insert to authenticated
  with check (auth.uid() = organiser_id);
-- Organisers may update their own session, but only the columns granted
-- below — status/organiser_id changes must go through a service-role API
-- route (e.g. /api/cancel-session, /api/leave, triggerPayments), never
-- directly from the browser.
create policy "Organisers can update their own sessions" on sessions
  for update to authenticated
  using (auth.uid() = organiser_id)
  with check (auth.uid() = organiser_id);
revoke update on sessions from anon, authenticated;
grant update (is_public, team_name, game_type, matched_session_id) on sessions to authenticated;

-- PLAYERS: restricted column-level read, all writes via service-role only
create policy "Anyone can view player names" on players
  for select using (true);
-- INSERT/UPDATE/DELETE are done exclusively by the service-role client
-- (bypasses RLS) — see /api/join, /api/leave, /api/link-player-account.
-- Column-level: phone, stripe_customer_id, stripe_payment_method_id are not
-- selectable by anon/authenticated at all, even for a user's own row — a
-- client needing its own phone back must go through a server route
-- (see app/api/latest-phone/route.ts).
revoke select on players from anon, authenticated;
grant select (id, name, joined_at, session_id, user_id) on players to anon, authenticated;

-- Postgres's count() aggregate needs table-level SELECT on players
-- regardless of which columns it touches, so a plain `players(count)`
-- embedded-resource query 42501s for anon/authenticated even though it
-- reveals nothing beyond a number. This function runs as its owner
-- (SECURITY DEFINER) so it can compute that count without needing the
-- broader grant — it returns nothing beyond what the RLS policies above
-- already let anon read row-by-row, plus a bare player count. Used by the
-- venue slots page's client-side realtime refresh (server components read
-- via the service-role client instead and never hit this wall).
create or replace function venue_sessions_with_counts(
  p_venue_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  id uuid,
  slot_id uuid,
  organiser_id uuid,
  status text,
  organiser_name text,
  is_public boolean,
  game_type text,
  slot_ids uuid[],
  slots jsonb,
  players jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.slot_id,
    s.organiser_id,
    s.status,
    s.organiser_name,
    s.is_public,
    s.game_type,
    s.slot_ids,
    jsonb_build_object(
      'id', sl.id,
      'date', sl.date,
      'start_time', sl.start_time,
      'end_time', sl.end_time,
      'price', sl.price,
      'max_players', sl.max_players,
      'venue_id', sl.venue_id,
      'pitches', jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'format', p.format,
        'surface', p.surface,
        'max_players', p.max_players,
        'peak_price', p.peak_price,
        'offpeak_price', p.offpeak_price,
        'weekend_price', p.weekend_price
      )
    ) as slots,
    jsonb_build_array(
      jsonb_build_object('count', (select count(*) from players pl where pl.session_id = s.id))
    ) as players
  from sessions s
  join slots sl on sl.id = s.slot_id
  join pitches p on p.id = sl.pitch_id
  where sl.venue_id = p_venue_id
    and sl.date >= p_from_date
    and sl.date <= p_to_date
    and s.status in ('filling', 'confirmed')
$$;

revoke all on function venue_sessions_with_counts(uuid, date, date) from public;
grant execute on function venue_sessions_with_counts(uuid, date, date) to anon, authenticated;

-- BOOKINGS: anyone can read; INSERT is service-role only, after payment.
create policy "Anyone can view bookings" on bookings
  for select using (true);

-- MESSAGES: anyone can read; only a verified member of the session can send
-- as themselves. Guest (unauthenticated) messages go through
-- /api/send-message, which verifies the guest's phone server-side and
-- inserts via the service-role client — no guest-facing INSERT policy.
create policy "Anyone can view messages" on messages
  for select using (true);
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

-- NOTIFICATIONS: users can only read/mark-read their own. INSERT is
-- service-role only (written by join/leave/cancel/triggerPayments).
create policy "Users can read own notifications" on notifications
  for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- Seed data — example venue for local/dev setup
-- ============================================================
insert into venues (name, address)
values ('Globe Football Pitch', '110 Globe Rd, Bethnal Green, London E1 4DZ')
on conflict do nothing;

insert into pitches (venue_id, name, format, surface, max_players, peak_price, offpeak_price, weekend_price)
select id, 'Main Pitch', '5-a-side', '4G', 10, 50, 30, 40
from venues
where name = 'Globe Football Pitch'
on conflict do nothing;

-- Enable realtime for relevant tables
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table messages;
