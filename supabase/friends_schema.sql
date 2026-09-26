-- Friends: read-only calendar viewing
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Nothing in this repo can run
-- it for you - the Postgres schema/RLS for this project isn't tracked
-- anywhere else, it only lives live in your Supabase project.
--
-- Before running, this script assumes two things about your live schema
-- that are inferred (not directly confirmed) from the app's existing sync
-- code: that `tasks` and `tags` have a `user_id` column (already confirmed
-- for `streak_freezes`/`settings`), and that none of `tasks` / `tags` /
-- `task_completions` / `streak_freezes` carry a pre-existing RESTRICTIVE
-- policy (the Postgres/Supabase default is PERMISSIVE). If either is wrong,
-- this script will simply fail with a clear error - fix and re-run, nothing
-- partial or unsafe happens either way.
--
-- All three tables are created first, then all policies - `profiles`'s own
-- policy references `friendships`, so `friendships` must already exist
-- before any policy mentioning it is created (this is why the first attempt
-- at running this file failed with "relation public.friendships does not
-- exist" when everything was interleaved table-then-its-own-policies).

-- ---------- tables ----------

-- One row per account: a display name shown to friends, plus a mirror of
-- their current theme choice (so a friend's calendar can be shown in their
-- own colors, not the viewer's) - never browsable by strangers, only your
-- own row or a confirmed friend's.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  theme text,
  random_theme_colors jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists theme text;
alter table public.profiles add column if not exists random_theme_colors jsonb;

-- A short-lived, single-use code. Deliberately has NO policy letting anyone
-- but its owner read it - redemption goes through the redeem_friend_code()
-- function below instead, which is SECURITY DEFINER and bypasses RLS
-- entirely, so this table stays otherwise completely unreadable.
create table if not exists public.friend_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Undirected pairs (order doesn't mean anything - always normalized so
-- user_a < user_b, giving exactly one row per pair). No insert policy for
-- normal users - rows are only ever created by redeem_friend_code() below.
create table if not exists public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

alter table public.profiles enable row level security;
alter table public.friend_codes enable row level security;
alter table public.friendships enable row level security;

-- ---------- grants ----------
-- Supabase stops auto-granting Data API access to new tables from
-- 2026-10-30 onward - without these, a fresh project running this script
-- after that date would create the tables above but the client library
-- would get "permission denied" on all of them despite correct RLS. Scoped
-- to exactly what each table's policies above actually allow: friendships
-- has no insert policy for normal users (only redeem_friend_code(), which
-- is SECURITY DEFINER and doesn't need this grant), so insert is
-- deliberately left out here too.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.friend_codes to authenticated;
grant select, delete on public.friendships to authenticated;

-- ---------- policies ----------
-- Each one is dropped first if it already exists, so this whole script is
-- safe to paste and run again from scratch regardless of how far a
-- previous attempt got before failing (e.g. the "friendships does not
-- exist" ordering bug this file used to have).

drop policy if exists "select own or friends profiles" on public.profiles;
create policy "select own or friends profiles" on public.profiles
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships f
      where (f.user_a = auth.uid() and f.user_b = profiles.user_id)
         or (f.user_b = auth.uid() and f.user_a = profiles.user_id)
    )
  );

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "manage own codes" on public.friend_codes;
create policy "manage own codes" on public.friend_codes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "select own friendships" on public.friendships;
create policy "select own friendships" on public.friendships
  for select
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "delete own friendships" on public.friendships;
create policy "delete own friendships" on public.friendships
  for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- ---------- redeem_friend_code(p_code) ----------
-- Looks up the code, validates it, links both accounts (mutual), burns the
-- code (single-use), and hands back the other person's name. `for update`
-- row-locks the code for the duration of the call, closing the race where
-- two simultaneous redemptions of the same code could both pass validation
-- before either commits.

create or replace function public.redeem_friend_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_expires timestamptz;
  v_display_name text;
  v_a uuid;
  v_b uuid;
  v_caller_tier text;
  v_owner_tier text;
  v_friend_count int;
begin
  select user_id, expires_at into v_owner, v_expires
  from public.friend_codes
  where code = p_code
  for update;

  if v_owner is null then
    raise exception 'Invalid or already-used code.';
  end if;

  if v_expires < now() then
    raise exception 'That code has expired.';
  end if;

  if v_owner = auth.uid() then
    raise exception 'You can''t redeem your own code.';
  end if;

  -- Free members are capped at 1 friend - checked on both sides, since a
  -- friendship row links two accounts symmetrically regardless of who
  -- actually calls this function (whoever types the code in redeems it,
  -- but the other side gains a friend too). Premium/admin are unlimited.
  select membership_tier into v_caller_tier from public.profiles where user_id = auth.uid();
  if coalesce(v_caller_tier, 'free') = 'free' then
    select count(*) into v_friend_count
      from public.friendships where user_a = auth.uid() or user_b = auth.uid();
    if v_friend_count >= 1 then
      raise exception 'Free members can only have 1 friend - upgrade to Premium to add more.';
    end if;
  end if;

  select membership_tier into v_owner_tier from public.profiles where user_id = v_owner;
  if coalesce(v_owner_tier, 'free') = 'free' then
    select count(*) into v_friend_count
      from public.friendships where user_a = v_owner or user_b = v_owner;
    if v_friend_count >= 1 then
      raise exception 'That person is a Free member and already has a friend linked.';
    end if;
  end if;

  if v_owner < auth.uid() then
    v_a := v_owner;
    v_b := auth.uid();
  else
    v_a := auth.uid();
    v_b := v_owner;
  end if;

  insert into public.friendships (user_a, user_b)
  values (v_a, v_b)
  on conflict do nothing;

  delete from public.friend_codes where code = p_code;

  select display_name into v_display_name from public.profiles where user_id = v_owner;

  return jsonb_build_object('user_id', v_owner, 'display_name', coalesce(v_display_name, 'Friend'));
end;
$$;

revoke all on function public.redeem_friend_code(text) from public;
grant execute on function public.redeem_friend_code(text) to authenticated;

-- ---------- get_friend_calendar_data(p_friend_id) ----------
-- The ONLY way a friend's tasks/tags/completions/streak-freezes are ever
-- read. Deliberately not built as ordinary RLS `select` policies on those
-- four tables - sync.ts's pullFromServer() runs unfiltered selects against
-- them, trusting RLS alone to return "just mine" and overwriting the local
-- offline cache with whatever comes back, so any additive policy there
-- would make a signed-in user's own background sync start pulling their
-- friends' rows into their own local cache. This function checks the
-- friendship itself and returns a snapshot in one call instead, with zero
-- new grants on those four tables. Templates/template_tasks/settings are
-- deliberately excluded - those stay private.

create or replace function public.get_friend_calendar_data(p_friend_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_friend boolean;
  v_result jsonb;
begin
  select exists (
    select 1 from public.friendships f
    where (f.user_a = auth.uid() and f.user_b = p_friend_id)
       or (f.user_b = auth.uid() and f.user_a = p_friend_id)
  ) into v_is_friend;

  if not v_is_friend then
    raise exception 'Not friends with this user.';
  end if;

  select jsonb_build_object(
    -- Explicit column lists (not jsonb_agg(t)/jsonb_agg(tg), which would
    -- serialize the *entire* row) - a future column added to tasks/tags for
    -- something private would otherwise leak to every friend automatically,
    -- with no code change needed to cause it. Keep this in sync with
    -- FriendTaskRow/FriendTagRow in src/db/friends.ts.
    'tasks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'notes', t.notes,
        'time', t.time,
        'tag_id', t.tag_id,
        'priority', t.priority,
        'recurrence_type', t.recurrence_type,
        'recurrence_days', t.recurrence_days,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'sort_order', t.sort_order
      )), '[]'::jsonb)
      from public.tasks t
      where t.user_id = p_friend_id
    ),
    'tags', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', tg.id,
        'name', tg.name,
        'color', tg.color,
        'sort_order', tg.sort_order
      )), '[]'::jsonb)
      from public.tags tg
      where tg.user_id = p_friend_id
    ),
    'completions', (
      select coalesce(jsonb_agg(jsonb_build_object('task_id', c.task_id, 'date', c.date)), '[]'::jsonb)
      from public.task_completions c
      join public.tasks t2 on t2.id = c.task_id
      where t2.user_id = p_friend_id
    ),
    'freezes', (
      select coalesce(jsonb_agg(jsonb_build_object('date', sf.date)), '[]'::jsonb)
      from public.streak_freezes sf
      where sf.user_id = p_friend_id
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_friend_calendar_data(uuid) from public;
grant execute on function public.get_friend_calendar_data(uuid) to authenticated;
