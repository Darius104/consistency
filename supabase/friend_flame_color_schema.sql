-- A friend's calendar shows their Day Streak in their flame color too
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. Safe to re-run.
--
-- Replaces get_friend_calendar_data() (last defined in
-- friend_streak_style_schema.sql) with the same function plus one more
-- field, 'flame_color' - their "flameColor" settings row (Settings >
-- Widgets > Day Streak > Flame: classic / red / pink / purple / blue /
-- green / gold). Everything else it returns is unchanged.

create or replace function public.get_friend_calendar_data(p_friend_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_friend boolean;
  v_shares_results boolean;
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

  select coalesce(
    (select s.value from public.settings s
     where s.user_id = p_friend_id and s.key = 'shareTradingResults'),
    'true'
  ) <> 'false' into v_shares_results;

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
    ),
    'trading_results', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', tr.date,
        'value', tr.value,
        'unit', tr.unit
      )), '[]'::jsonb)
      from public.trading_results tr
      where tr.user_id = p_friend_id and v_shares_results
    ),
    'panel_order', (
      select s.value from public.settings s
      where s.user_id = p_friend_id and s.key = 'panelOrder'
    ),
    'hidden_widgets', (
      select s.value from public.settings s
      where s.user_id = p_friend_id and s.key = 'hiddenWidgets'
    ),
    'streak_style', (
      select s.value from public.settings s
      where s.user_id = p_friend_id and s.key = 'streakStyle'
    ),
    'flame_color', (
      select s.value from public.settings s
      where s.user_id = p_friend_id and s.key = 'flameColor'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_friend_calendar_data(uuid) from public;
grant execute on function public.get_friend_calendar_data(uuid) to authenticated;
