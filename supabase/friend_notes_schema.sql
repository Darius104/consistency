-- Friend notes: a short one-way text note you can send while viewing a
-- friend's calendar (see FriendCalendarView's "Send a note" button) - not
-- a chat thread, no replies, just a quiet "thinking of you" message. A
-- deliberately separate table from public.notes (that one is your own
-- private per-day notes) so the two never collide despite the similar name.
--
-- Deliberately no "seen" tracking - a note isn't an inbox item, it's a
-- temporary widget that shows up above the Streak widget on your own day
-- panel for as long as it exists, with delete as the only action on it.
-- Existing (seen_at) is dropped below and count_unseen_friend_notes()/
-- mark_all_friend_notes_seen() are dropped entirely - the client just
-- reads the row list directly (its length IS the count) and deletes a row
-- to dismiss it, same as any other delete already covered by RLS.
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Depends on public.friendships
-- from friends_schema.sql already existing. Safe to re-run.

create table if not exists public.friend_notes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.friend_notes drop column if exists seen_at;

create index if not exists idx_friend_notes_recipient
  on public.friend_notes(recipient_id, created_at);

alter table public.friend_notes enable row level security;

-- Supabase stops auto-granting Data API access to new tables from
-- 2026-10-30 onward - without this, a fresh project running this script
-- after that date would create the table above but the client library
-- would get "permission denied" despite correct RLS. No update grant - a
-- note is never edited, only inserted, read, and deleted.
grant select, insert, delete on public.friend_notes to authenticated;

-- Either side of a note can see it - the sender (so they know what they
-- sent), the recipient (so they can read it).
drop policy if exists "select own sent or received notes" on public.friend_notes;
create policy "select own sent or received notes" on public.friend_notes
  for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Only to a confirmed friend, and only as yourself - same friendship check
-- get_friend_calendar_data() already uses in friends_schema.sql.
drop policy if exists "send note to a friend" on public.friend_notes;
create policy "send note to a friend" on public.friend_notes
  for insert
  with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and exists (
      select 1 from public.friendships f
      where (f.user_a = auth.uid() and f.user_b = recipient_id)
         or (f.user_b = auth.uid() and f.user_a = recipient_id)
    )
  );

-- Only the recipient can dismiss a note from their own inbox - the sender
-- can't retract one after the fact.
drop policy if exists "recipient deletes own note" on public.friend_notes;
create policy "recipient deletes own note" on public.friend_notes
  for delete
  using (auth.uid() = recipient_id);

-- No longer needed now that a note has no "seen" state - dropped so a
-- re-run of this file leaves nothing stale behind.
drop function if exists public.mark_all_friend_notes_seen();
drop function if exists public.count_unseen_friend_notes();
