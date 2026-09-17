-- Real-time cross-device sync: lets one signed-in device push a change to
-- every other signed-in device automatically (within about a second),
-- instead of only refreshing on its own edits, launch, or reconnect.
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run.
--
-- A table isn't broadcast over Realtime just because RLS lets you read it -
-- it has to be explicitly added to Supabase's `supabase_realtime`
-- publication first (this is the one thing every Supabase project has by
-- default, so this script assumes it already exists - if it doesn't,
-- you'll get a clear "publication does not exist" error). The loop below
-- only adds a table if it isn't already a member, so this is safe to paste
-- and run again from scratch.
--
-- Security note: adding a table here does NOT bypass RLS - Supabase only
-- broadcasts a row's change to clients whose own RLS select policy would
-- actually let them read that row, same as a normal query. Every table
-- below already has an RLS policy scoped to auth.uid() = user_id (or, for
-- notes, the same via friends_schema.sql/notes_schema.sql), so this only
-- ever notifies you about your own data changing.

do $$
declare
  t text;
begin
  foreach t in array array[
    'tasks',
    'tags',
    'task_completions',
    'streak_freezes',
    'templates',
    'template_tasks',
    'notes',
    'settings'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
