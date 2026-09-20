-- Support tickets: members file Bug Report / Feature Request / General
-- Question tickets; only the admin sees everyone's, a member only ever
-- sees their own.
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Depends on is_admin() from
-- membership_admin_schema.sql already existing.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug', 'feature', 'question')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

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
