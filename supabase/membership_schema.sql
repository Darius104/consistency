-- Membership tier: Free / Premium
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Nothing in this repo can run
-- it for you - the Postgres schema/RLS for this project isn't tracked
-- anywhere else, it only lives live in your Supabase project.
--
-- Unlike bio/avatar_id (profile_customization_schema.sql), this column is
-- deliberately NOT covered by the existing "update own profile" policy in
-- practice: that policy is row-level (auth.uid() = user_id) and doesn't
-- distinguish columns, so a plain client-side `.update()` call could
-- otherwise self-upgrade a user to "premium". There's no real billing yet -
-- membership is set by hand, by you, by running an UPDATE in this same SQL
-- editor (which runs as a privileged role and bypasses ordinary grants).
-- Revoking UPDATE on just this column from the app-facing roles closes that
-- gap without needing a trigger or a new "is_admin" concept.

alter table public.profiles
  add column if not exists membership_tier text not null default 'free'
    check (membership_tier in ('free', 'premium'));

revoke update (membership_tier) on public.profiles from authenticated, anon;

-- To upgrade someone by hand, run (with their real user_id from auth.users):
--   update public.profiles set membership_tier = 'premium' where user_id = '<uuid>';
-- To revert:
--   update public.profiles set membership_tier = 'free' where user_id = '<uuid>';
