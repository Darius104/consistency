-- ---------- get_friend_streak_comparisons(p_friend_id) ----------
-- Backs the "Friend Comparison" widget when it's replicated onto a
-- friend's own calendar view (see REPLICABLE_WIDGET_IDS in
-- src/components/friends/FriendCalendarView.tsx) - that widget is supposed
-- to be an exact mirror of what the friend sees on their own device, which
-- means showing *their* friends and *their* streaks, not the viewer's.
--
-- Same shape and security model as get_friend_calendar_data (see
-- friends_schema.sql's own comment on why this isn't plain RLS, and
-- admin_view_calendar_schema.sql for the is_admin() exemption this
-- mirrors so an admin previewing a member's calendar sees this widget
-- too): checks the friendship, then returns one hop further - every
-- friend of p_friend_id, with just enough of their own
-- tasks/completions/freezes for the client to compute a streak the same
-- way computeStreak() already does for a direct friend. This deliberately
-- extends the same trust boundary a direct friendship already grants (you
-- can already see a friend's entire calendar) one hop further, purely to
-- render a number - nothing here is queryable for an arbitrary stranger
-- two hops away.
create or replace function public.get_friend_streak_comparisons(p_friend_id uuid)
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_id', p.avatar_id,
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
      where t.user_id = p.user_id
    ),
    'completions', (
      select coalesce(jsonb_agg(jsonb_build_object('task_id', c.task_id, 'date', c.date)), '[]'::jsonb)
      from public.task_completions c
      join public.tasks t2 on t2.id = c.task_id
      where t2.user_id = p.user_id
    ),
    'freezes', (
      select coalesce(jsonb_agg(jsonb_build_object('date', sf.date)), '[]'::jsonb)
      from public.streak_freezes sf
      where sf.user_id = p.user_id
    )
  )), '[]'::jsonb)
  into v_result
  from public.profiles p
  where p.user_id in (
    select case when f.user_a = p_friend_id then f.user_b else f.user_a end
    from public.friendships f
    where f.user_a = p_friend_id or f.user_b = p_friend_id
  );

  return v_result;
end;
$$;

revoke all on function public.get_friend_streak_comparisons(uuid) from public;
grant execute on function public.get_friend_streak_comparisons(uuid) to authenticated;
