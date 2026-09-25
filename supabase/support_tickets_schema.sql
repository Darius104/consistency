-- Support tickets: members file Bug Report / Feature Request / General
-- Question tickets; only the admin sees everyone's, a member only ever
-- sees their own. Each ticket is a two-way chat (support_ticket_messages
-- below) between the filer and the admin, with a manually-set status
-- (open / in_progress / resolved) the admin moves along as they work it.
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Depends on is_admin() from
-- membership_admin_schema.sql already existing. Safe to re-run from
-- scratch, or on top of an already-deployed copy of the old two-status
-- (open/resolved) version of this file - the constraint block below finds
-- and replaces whatever the existing status check is, by definition rather
-- than by guessing its auto-generated name.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug', 'feature', 'question')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

-- When the filer last opened this ticket's thread - drives their own
-- unread-message badge (see count_unseen_messages_for_member() below).
-- Never touched directly by the client; only mark_ticket_seen_by_member()
-- writes it, so a member can never backdate/forge it to hide a message.
alter table public.support_tickets add column if not exists member_last_seen_at timestamptz;

-- Same idea, admin side: when the admin last opened this ticket's thread -
-- drives the admin's own badge/per-ticket "new" marker. Written only by
-- mark_ticket_seen_by_admin().
alter table public.support_tickets add column if not exists admin_last_seen_at timestamptz;

-- Widen the status check to add 'in_progress' - found by definition (same
-- technique as membership_admin_schema.sql's own tier-constraint migration)
-- rather than assuming Postgres's auto-generated constraint name, so this
-- works whether this table was just created above or already existed from
-- an earlier, two-status version of this file.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.support_tickets'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.support_tickets drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.support_tickets add constraint support_tickets_status_check
  check (status in ('open', 'in_progress', 'resolved'));

alter table public.support_tickets enable row level security;

-- Supabase stops auto-granting Data API access to new tables from
-- 2026-10-30 onward - without this, a fresh project running this script
-- after that date would create the table above but the client library
-- would get "permission denied" despite correct RLS.
grant select, insert, update, delete on public.support_tickets to authenticated;

-- A member sees their own tickets; an admin sees everyone's (same
-- is_admin() helper the membership admin panel already uses).
drop policy if exists "select own or admin tickets" on public.support_tickets;
create policy "select own or admin tickets" on public.support_tickets
  for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "insert own ticket" on public.support_tickets;
create policy "insert own ticket" on public.support_tickets
  for insert
  with check (auth.uid() = user_id);

-- Only an admin can change a ticket (in practice, just its status) - a
-- member can file a ticket but never edit or resolve it themselves.
drop policy if exists "admin update ticket" on public.support_tickets;
create policy "admin update ticket" on public.support_tickets
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Either side can remove a ticket entirely - the filer their own (e.g. they
-- opened it by mistake), the admin any of them (cleanup once resolved).
-- The messages table's own on delete cascade takes its whole thread with
-- it, so there's nothing extra to clean up here.
drop policy if exists "delete own or admin ticket" on public.support_tickets;
create policy "delete own or admin ticket" on public.support_tickets
  for delete
  using (auth.uid() = user_id or public.is_admin());

-- ---------- support_ticket_messages ----------
-- One row per chat message on a ticket - the ticket's own `description` is
-- shown as the first bubble in the thread (see the app's own rendering),
-- so it's deliberately not duplicated into a message row here.

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_messages_ticket
  on public.support_ticket_messages(ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;

grant select, insert on public.support_ticket_messages to authenticated;

-- Same visibility rule as the ticket itself: the ticket's owner, or the
-- admin, via a join back to support_tickets (a message has no owner column
-- of its own to check directly against).
drop policy if exists "select own or admin ticket messages" on public.support_ticket_messages;
create policy "select own or admin ticket messages" on public.support_ticket_messages
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

-- Either side of the conversation can post - the ticket's owner, or the
-- admin - but only as themselves (sender_id must be the caller).
drop policy if exists "reply on own or admin ticket" on public.support_ticket_messages;
create policy "reply on own or admin ticket" on public.support_ticket_messages
  for insert
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    )
  );

-- ---------- unread-message badges ----------
-- Two different counters for two different roles: the admin's badge is a
-- simple count of brand-new (status = 'open') tickets - no read-tracking
-- needed, computed straight off support_tickets client-side. A member's
-- badge is "how many of the admin's replies have I not opened yet", which
-- does need read-tracking (member_last_seen_at above), so it's computed
-- here instead of client-side.

-- Bypasses RLS only to update the one column it's hardcoded to touch, on
-- only the caller's own ticket - a member can never call this for someone
-- else's ticket (the where clause enforces that, not the caller-supplied
-- ticket id alone).
create or replace function public.mark_ticket_seen_by_member(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set member_last_seen_at = now()
  where id = p_ticket_id and user_id = auth.uid();
end;
$$;

revoke all on function public.mark_ticket_seen_by_member(uuid) from public;
grant execute on function public.mark_ticket_seen_by_member(uuid) to authenticated;

-- Plain (not SECURITY DEFINER) - the join's own two tables already carry
-- RLS that restricts this to the caller's own tickets/messages, same as
-- if the caller ran the query directly, so there's no elevated-privilege
-- reason to bypass RLS here the way the two SECURITY DEFINER functions
-- above do.
create or replace function public.count_unseen_messages_for_member()
returns integer
language sql
stable
as $$
  select count(*)::int
  from public.support_ticket_messages m
  join public.support_tickets t on t.id = m.ticket_id
  where t.user_id = auth.uid()
    and m.sender_id <> auth.uid()
    and (t.member_last_seen_at is null or m.created_at > t.member_last_seen_at);
$$;

revoke all on function public.count_unseen_messages_for_member() from public;
grant execute on function public.count_unseen_messages_for_member() to authenticated;

-- Same idea in the other direction: a ticket counts as unseen by the admin
-- if they've never opened it at all, or the member has posted since the
-- admin last looked - covers both "brand new ticket" and "they replied to
-- my reply" without needing two separate counters.
create or replace function public.mark_ticket_seen_by_admin(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do this.';
  end if;
  update public.support_tickets
  set admin_last_seen_at = now()
  where id = p_ticket_id;
end;
$$;

revoke all on function public.mark_ticket_seen_by_admin(uuid) from public;
grant execute on function public.mark_ticket_seen_by_admin(uuid) to authenticated;

-- Plain, same reasoning as count_unseen_messages_for_member() - RLS on
-- support_tickets already scopes `t` to every ticket for an admin caller,
-- or just their own for anyone else, so there's nothing here for a
-- non-admin caller to see beyond their own ticket's admin_last_seen_at.
create or replace function public.count_unseen_tickets_for_admin()
returns integer
language sql
stable
as $$
  select count(*)::int
  from public.support_tickets t
  where t.admin_last_seen_at is null
    or exists (
      select 1 from public.support_ticket_messages m
      where m.ticket_id = t.id
        and m.sender_id <> auth.uid()
        and m.created_at > t.admin_last_seen_at
    );
$$;

revoke all on function public.count_unseen_tickets_for_admin() from public;
grant execute on function public.count_unseen_tickets_for_admin() to authenticated;
