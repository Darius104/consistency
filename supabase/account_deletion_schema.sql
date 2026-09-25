-- Account deletion + terms-acceptance timestamp
--
-- Needed now that the app is meant for the public, not just known friends -
-- GDPR's "right to erasure" expects real self-service deletion, not just
-- sign-out, and having a timestamp of when someone actually agreed to the
-- Terms and Conditions is worth keeping once signups aren't just people
-- you personally know.
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Depends on profiles/friend_codes/
-- friendships (friends_schema.sql), friend_notes (friend_notes_schema.sql),
-- and support_tickets/support_ticket_messages (support_tickets_schema.sql)
-- already existing. Safe to re-run.

alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- Deletes every row this account owns, then the auth.users row itself -
-- explicit per-table deletes rather than relying purely on each table's own
-- "on delete cascade" (most of them have it, but tasks/tags/task_completions/
-- streak_freezes/templates/template_tasks/settings/notes predate this repo's
-- SQL files and were never confirmed to - see friends_schema.sql's own note
-- about this same uncertainty). Ordered child-before-parent so none of this
-- depends on any assumption about cascade behavior at all.
--
-- SECURITY DEFINER is what makes this possible in the first place - a plain
-- authenticated user has no grant to delete from auth.users directly (that's
-- normally service-role/Admin-API only), but a function owned by the
-- project's own postgres role runs with ITS privileges instead, which does
-- have that access. auth.uid() inside the function body still always
-- resolves to the calling user (Postgres functions don't lose that), so
-- this can only ever delete the caller's own account, never anyone else's.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  delete from public.task_completions
    where task_id in (select id from public.tasks where user_id = v_uid);

  delete from public.template_tasks
    where template_id in (
      select t.id from public.templates t
      join public.tags g on g.id = t.tag_id
      where g.user_id = v_uid
    );

  delete from public.templates
    where tag_id in (select id from public.tags where user_id = v_uid);

  delete from public.tasks where user_id = v_uid;
  delete from public.tags where user_id = v_uid;
  delete from public.streak_freezes where user_id = v_uid;
  delete from public.notes where user_id = v_uid;
  delete from public.settings where user_id = v_uid;

  delete from public.friend_notes where sender_id = v_uid or recipient_id = v_uid;
  delete from public.friendships where user_a = v_uid or user_b = v_uid;
  delete from public.friend_codes where user_id = v_uid;

  delete from public.support_ticket_messages where sender_id = v_uid;
  delete from public.support_tickets where user_id = v_uid;

  delete from public.profiles where user_id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
