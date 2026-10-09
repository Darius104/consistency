-- Server-sent reminders: instead of each device scheduling its own local
-- reminders (which can't know you already ticked the task on another
-- device), the server checks every minute what's due, skips anything
-- already completed anywhere, and pushes it through Apple (APNs).
--
-- Pieces:
--   push_devices    - each phone that signed up for pushes: its APNs token,
--                     which APNs environment it belongs to, and its time zone
--                     (so a task at 07:00 means 07:00 where the user is).
--   sent_reminders  - what's already been sent, so nothing goes out twice.
--   send-reminders  - the Edge Function that does the work
--                     (supabase/functions/send-reminders/index.ts).
--   a pg_cron job   - calls that function once a minute (see the bottom of
--                     this file - it's a separate step, since it needs the
--                     function deployed first).
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste ->
-- Run. Safe to re-run.

create table if not exists public.push_devices (
  token       text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform    text not null default 'ios',
  -- 'sandbox' for dev builds, 'production' for TestFlight/App Store.
  environment text not null default 'production',
  timezone    text not null default 'UTC',
  updated_at  timestamptz not null default now()
);

create index if not exists push_devices_user_idx on public.push_devices (user_id);

alter table public.push_devices enable row level security;

-- New tables need an explicit grant (Supabase stopped auto-granting Data
-- API access on 2026-10-30).
grant select, insert, update, delete on public.push_devices to authenticated;

drop policy if exists "manage own push devices" on public.push_devices;
create policy "manage own push devices" on public.push_devices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Only the Edge Function (service role) reads/writes this - no grant to
-- `authenticated`, so the app can't see or touch it.
create table if not exists public.sent_reminders (
  user_id  uuid not null references auth.users(id) on delete cascade,
  -- "<taskId>:<date>:<time>" or "eod:<date>".
  key      text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.sent_reminders enable row level security;

-- Old rows are only needed for a day or two (a reminder's own day) - keep
-- the table small.
create index if not exists sent_reminders_sent_at_idx on public.sent_reminders (sent_at);
