-- Membership: adds an "admin" tier on top of Free/Premium
-- (see membership_schema.sql for the base membership_tier column)
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run.
--
-- Admin is, like Premium, never settable through the app - you grant it to
-- yourself (only) by running an UPDATE in this same SQL editor, at the very
-- bottom of this file. What IS new here is a safe way for an admin to see
-- every member and flip someone between Free/Premium *from inside the app*,
-- without needing to open the SQL editor each time:
--
--   - is_admin(): a SECURITY DEFINER helper so RLS policies and the
--     function below can check "is the calling user an admin?" without
--     recursively re-applying RLS to the check itself.
--   - A SELECT policy letting admins read every profile (everyone else
--     still only sees their own + friends', unchanged).
--   - admin_set_membership_tier(): a SECURITY DEFINER function the app can
--     call to flip someone's tier. It re-checks is_admin() itself server
--     side (never trusts the caller), and only ever accepts 'free' or
--     'premium' as the new value - it will refuse to grant 'admin' through
--     this path, so the app itself can never mint another admin.

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%membership_tier%'
  loop
    execute format('alter table public.profiles drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_membership_tier_check
  check (membership_tier in ('free', 'premium', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and membership_tier = 'admin'
  );
$$;

drop policy if exists "admins can select all profiles" on public.profiles;
create policy "admins can select all profiles" on public.profiles
  for select
  using (public.is_admin());

create or replace function public.admin_set_membership_tier(target_user_id uuid, new_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change membership tiers.';
  end if;
  if new_tier not in ('free', 'premium') then
    raise exception 'Admins can only set free or premium, not %', new_tier;
  end if;
  update public.profiles set membership_tier = new_tier where user_id = target_user_id;
end;
$$;

grant execute on function public.admin_set_membership_tier(uuid, text) to authenticated;

-- Finally, make yourself the admin (only ever run this for your own
-- account - swap in your real user_id from Authentication -> Users):
--   update public.profiles set membership_tier = 'admin' where user_id = '<your-uuid>';
