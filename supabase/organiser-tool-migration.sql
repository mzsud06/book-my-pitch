-- Organiser tool migration. Additive: the old venue/slot flow keeps working.
-- A "game" is now a session with game_kind = 'organiser' and no slot.

-- Old venue sessions always had a slot; organiser games have none.
alter table sessions alter column slot_id drop not null;

-- Add 'full' (every spot paid for, waiting on the organiser to book the pitch).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sessions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.sessions drop constraint %I', c);
  end loop;
end $$;

alter table sessions add constraint sessions_status_check
  check (status in ('filling', 'full', 'confirmed', 'cancelled', 'payment_failed', 'expired'));

alter table sessions
  add column if not exists game_kind text not null default 'venue'
    check (game_kind in ('venue', 'organiser')),
  add column if not exists title text,
  add column if not exists venue_name text,
  add column if not exists game_date date,
  add column if not exists start_time time,
  add column if not exists total_cost_pence integer,
  add column if not exists max_players integer,
  -- Each player's share of the pitch cost, in pence (rounded up).
  add column if not exists share_pence integer,
  -- When the last spot was paid for; the organiser has 24h from here.
  add column if not exists full_at timestamptz;

-- Players now hold funds with a manual-capture PaymentIntent instead of a saved card.
alter table players alter column stripe_payment_method_id drop not null;
alter table players add column if not exists payment_intent_id text;
-- payment_intent_id is deliberately NOT in the column-level SELECT grant on
-- players, so it stays unreadable from the browser.

-- Organisers: one Stripe Express account per user, created when they make their first game.
create table if not exists organisers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  created_at timestamptz default now()
);
alter table organisers enable row level security;
create policy "Organisers can read own row" on organisers
  for select using (auth.uid() = user_id);
-- All writes go through the service-role client.

-- Whether the organiser is one of the players (their own share is not collected in-app).
alter table sessions add column if not exists organiser_plays boolean not null default true;
