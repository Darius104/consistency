-- Profile customization: avatar, bio
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Nothing in this repo can run
-- it for you - the Postgres schema/RLS for this project isn't tracked
-- anywhere else, it only lives live in your Supabase project.
--
-- Purely additive columns on the existing `profiles` table (created in
-- friends_schema.sql) - no new RLS or RPC needed, since that table's
-- existing "select own or friends profiles" / "update own profile" policies
-- already cover these columns exactly like display_name/theme.

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_id text;
