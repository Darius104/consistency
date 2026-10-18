-- Lock membership_tier for real.
--
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste
-- this whole file -> Run. Safe to run again.
--
-- Why: membership_schema.sql tried to stop users from changing their own
-- tier with `revoke update (membership_tier) ...`, but a column-level revoke
-- does nothing while the role still has UPDATE on the whole table - and
-- friends_schema.sql grants exactly that (`grant select, insert, update on
-- public.profiles to authenticated`). So any signed-in user could set their
-- own row to 'admin' through the "update own profile" policy (or insert a
-- brand-new profile as 'admin').
--
-- This trigger checks every insert/update on profiles: when it comes from
-- the app (the `authenticated` / `anon` roles), a new profile always starts
-- as 'free' and an existing tier can't be changed. Changes made by you in
-- this SQL editor, by the server (service role), or through the SECURITY
-- DEFINER admin_set_membership_tier() function (which runs as its owner)
-- are unaffected.

create or replace function public.protect_membership_tier()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.membership_tier := 'free';
    elsif new.membership_tier is distinct from old.membership_tier then
      raise exception 'membership_tier can only be changed by an admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_membership_tier on public.profiles;
create trigger protect_membership_tier
  before insert or update on public.profiles
  for each row execute function public.protect_membership_tier();
