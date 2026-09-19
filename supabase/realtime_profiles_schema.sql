-- Real-time membership tier updates
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run.
--
-- Adds `profiles` to the same realtime publication realtime_setup.sql
-- already uses for tasks/tags/etc, so changing someone's membership_tier
-- in the admin panel reaches their already-open app within about a second
-- instead of requiring them to relaunch it (see useMembership.ts's own
-- subscription, filtered to auth.uid() = user_id - RLS still applies, so
-- this only ever notifies a member about their own row changing).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end $$;
