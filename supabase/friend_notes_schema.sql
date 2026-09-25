-- Friend notes: a short one-way text note you can send while viewing a
-- friend's calendar (see FriendCalendarView's "Send a note" button) - not
-- a chat thread, no replies, just a quiet "thinking of you" message. A
-- deliberately separate table from public.notes (that one is your own
-- private per-day notes) so the two never collide despite the similar name.
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Depends on public.friendships
-- from friends_schema.sql already existing. Safe to re-run.

create table if not exists public.friend_notes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  -- Set only by mark_friend_note_seen() below - drives the recipient's own
  -- unread badge, same shape as support_tickets' *_last_seen_at columns.
  seen_at timestamptz
);

create index if not exists idx_friend_notes_recipient
  on public.friend_notes(recipient_id, created_at);

alter table public.friend_notes enable row level security;

-- Supabase stops auto-granting Data API access to new tables from
-- 2026-10-30 onward - without this, a fresh project running this script
-- after that date would create the table above but the client library
-- would get "permission denied" despite correct RLS. No update grant - only
-- the SECURITY DEFINER function below ever sets seen_at.
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

-- Marks every one of the caller's own unseen notes seen at once - opening
-- the Friends tab counts as "you've seen your notes", same simple
-- mark-the-whole-inbox-read model as a notifications bell, rather than
-- tracking each note's read state individually.
create or replace function public.mark_all_friend_notes_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friend_notes
  set seen_at = now()
  where recipient_id = auth.uid() and seen_at is null;
end;
$$;

revoke all on function public.mark_all_friend_notes_seen() from public;
grant execute on function public.mark_all_friend_notes_seen() to authenticated;

-- Plain (not SECURITY DEFINER) - RLS already scopes this to the caller's
-- own received notes, same as if they queried the table directly.
create or replace function public.count_unseen_friend_notes()
returns integer
language sql
stable
as $$
  select count(*)::int
  from public.friend_notes
  where recipient_id = auth.uid() and seen_at is null;
$$;

revoke all on function public.count_unseen_friend_notes() from public;
grant execute on function public.count_unseen_friend_notes() to authenticated;
