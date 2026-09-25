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
-- would get "permission denied" despite correct RLS. No delete here since
-- no policy below allows it either.
grant select, insert, update on public.support_tickets to authenticated;

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
