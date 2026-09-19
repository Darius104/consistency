-- Admin: view any member's calendar
--
-- Run this ONCE in the Supabase dashboard, AFTER membership_admin_schema.sql
-- (this depends on the is_admin() helper defined there).
--
-- Reuses get_friend_calendar_data() as-is rather than adding a parallel
-- function - the only change is letting an admin through even when they
-- aren't actually friends with the target. The profile fetch half of this
-- (fetchFriendCalendarData() in src/db/friends.ts also selects from
-- `profiles` directly) already works for admins with no change, since
-- membership_admin_schema.sql's "admins can select all profiles" policy
-- already covers it.

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

  if not v_is_friend and not public.is_admin() then
    raise exception 'Not friends with this user.';
  end if;

  select jsonb_build_object(
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
