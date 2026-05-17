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

-- Slots (each bookable time period)
create table if not exists slots (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  type text not null check (type in ('offpeak', 'peak', 'weekend')),
  price integer not null, -- in GBP (whole pounds, e.g. 45 = £45)
  max_players integer not null default 10,
  created_at timestamptz default now(),
  unique (venue_id, date, start_time)
);

-- Sessions (a group's attempt to fill a slot)
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  slot_id uuid references slots(id) on delete cascade not null,
  organiser_id uuid references auth.users(id),
  organiser_name text,
  organiser_phone text,
  status text not null default 'filling' check (status in ('filling', 'confirmed', 'cancelled', 'payment_failed')),
  created_at timestamptz default now()
);
-- Migration (run in Supabase SQL editor if table already exists):
-- alter table sessions add column if not exists organiser_name text;
-- alter table sessions add column if not exists organiser_phone text;

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
alter table slots enable row level security;
alter table sessions enable row level security;
alter table players enable row level security;
alter table bookings enable row level security;
alter table messages enable row level security;

-- RLS Policies

-- Venues: owners can see their own, anyone can read
create policy "Anyone can view venues" on venues for select using (true);
create policy "Owners can manage their venue" on venues for all using (auth.uid() = owner_id);

-- Slots: anyone can read
create policy "Anyone can view slots" on slots for select using (true);
create policy "Owners can manage slots" on slots for all
  using (exists (select 1 from venues where id = venue_id and owner_id = auth.uid()));
-- Service role can insert (API routes use service role)
create policy "Service role can insert slots" on slots for insert with check (true);

-- Sessions: anyone can read
create policy "Anyone can view sessions" on sessions for select using (true);
create policy "Anyone can create sessions" on sessions for insert with check (true);
create policy "Service role can update sessions" on sessions for update using (true);

-- Players: anyone can read names (for the player list), but details are protected
create policy "Anyone can view player names" on players for select using (true);
create policy "Anyone can join a session" on players for insert with check (true);

-- Bookings: anyone can read
create policy "Anyone can view bookings" on bookings for select using (true);
create policy "Service role can create bookings" on bookings for insert with check (true);

-- Messages: anyone in a confirmed session can read/write
create policy "Anyone can view messages" on messages for select using (true);
create policy "Anyone can send messages" on messages for insert with check (true);

-- Insert Globe Football Pitch venue (update owner_id after creating owner account)
insert into venues (name, address)
values ('Globe Football Pitch', '110 Globe Rd, Bethnal Green, London E1 4DZ')
on conflict do nothing;

-- Enable realtime for relevant tables
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table messages;
