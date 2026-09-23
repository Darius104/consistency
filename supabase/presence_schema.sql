-- Friend presence: "last seen" timestamp for the online/offline indicator
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run.
--
-- Purely additive column on the existing `profiles` table - no new RLS
-- needed, since that table's existing "select own or friends profiles" /
-- "update own profile" policies already cover it exactly like
-- display_name/bio/theme. Live online/offline status itself is NOT stored
-- here - it's tracked entirely in-memory via Supabase Realtime Presence
-- (see src/hooks/usePresence.ts), which needs no schema at all. This
-- column only ever answers "when did they last have the app open", for
-- the moment they're NOT currently online.

alter table public.profiles add column if not exists last_seen_at timestamptz;
