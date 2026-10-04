-- Trading results: one signed number the user logs per day (profitable or
-- not). Each row remembers its OWN unit (R-multiple / percent / currency)
-- at the time it was logged - see src/utils/trading.ts - rather than being
-- reinterpreted later under whatever the global display preference is set
-- to, since a "+4" logged as a percent is not the same number as "+4"
-- logged as dollars. At most one result per day, same shape as
-- streak_freezes (a (user_id, date) row, no separate id column).
--
-- Run this in the Supabase dashboard: your project -> SQL Editor -> New
-- query -> paste this whole file -> Run. Safe to re-run on a project that
-- already has this table from an earlier version of this file - the ALTER
-- TABLE below only adds the `unit` column if it isn't already there.
-- Nothing in this repo can run it for you - the Postgres schema/RLS for
-- this project isn't tracked anywhere else, it only lives live in your
-- Supabase project.

create table if not exists public.trading_results (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date       date not null,
  value      double precision not null,
  unit       text not null default 'r',
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Existing projects created this table before `unit` existed - adds it
-- (defaulting every already-logged row to 'r', the app's own original
-- default) without touching anything else.
alter table public.trading_results add column if not exists unit text not null default 'r';

create index if not exists idx_trading_results_user_date on public.trading_results(user_id, date);

alter table public.trading_results enable row level security;

-- Supabase stops auto-granting Data API access to new tables from
-- 2026-10-30 onward - without this, a fresh project running this script
-- after that date would create the table above but the client library
-- would get "permission denied" despite correct RLS.
grant select, insert, update, delete on public.trading_results to authenticated;

drop policy if exists "select own trading results" on public.trading_results;
create policy "select own trading results" on public.trading_results
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own trading results" on public.trading_results;
create policy "insert own trading results" on public.trading_results
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own trading results" on public.trading_results;
create policy "update own trading results" on public.trading_results
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own trading results" on public.trading_results;
create policy "delete own trading results" on public.trading_results
  for delete
  using (auth.uid() = user_id);
