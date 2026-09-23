-- Notes: quick free-text notes attached to a specific day
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Nothing in this repo can run
-- it for you - the Postgres schema/RLS for this project isn't tracked
-- anywhere else, it only lives live in your Supabase project.
--
-- This mirrors the shape every other per-user table in this app already
-- uses (tags, tasks, streak_freezes, settings): a user_id column that
-- defaults to auth.uid() (the client never sends it explicitly - see
-- src/db/queries.ts, none of its upsert payloads include a user_id field),
-- and one basic RLS policy per action scoped to auth.uid() = user_id. If
-- your actual tables don't follow that pattern, this script will simply
-- fail with a clear error - fix and re-run, nothing partial or unsafe
-- happens either way.
--
-- Deliberately NOT included in get_friend_calendar_data() (see
-- friends_schema.sql) - notes are personal context, never shown to a
-- friend viewing your calendar.
--
-- after_group_key: which tag-group (by tag id, or NULL for "before all
-- groups") a note is anchored after, so it can be dragged to any position
-- among that day's tag groups instead of always sitting at the top.
-- Ordinary upserts through src/db/queries.ts persist this - no RPC needed
-- (unlike tags/tasks, which reassign a shared global order in one batch,
-- each note's position is independent of every other day's notes).

create table if not exists public.notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date            date not null,
  content         text not null,
  sort_order      integer not null default 0,
  after_group_key text,
  created_at      timestamptz not null default now()
);

alter table public.notes add column if not exists sort_order integer not null default 0;
alter table public.notes add column if not exists after_group_key text;

create index if not exists idx_notes_user_date on public.notes(user_id, date);

alter table public.notes enable row level security;

-- Supabase stops auto-granting Data API access to new tables from
-- 2026-10-30 onward - without this, a fresh project running this script
-- after that date would create the table above but the client library
-- would get "permission denied" despite correct RLS.
grant select, insert, update, delete on public.notes to authenticated;

drop policy if exists "select own notes" on public.notes;
create policy "select own notes" on public.notes
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own notes" on public.notes;
create policy "insert own notes" on public.notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own notes" on public.notes;
create policy "update own notes" on public.notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own notes" on public.notes;
create policy "delete own notes" on public.notes
  for delete
  using (auth.uid() = user_id);
