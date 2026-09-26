-- Premium codes: gift Premium to someone, or run a discount/promo.
--
-- There's no code-generation UI - codes are created by hand in the SQL
-- editor (same "set by hand" model membership_admin_schema.sql already
-- uses for setting someone's tier directly), e.g.:
--
--   insert into public.premium_codes (code, max_redemptions, expires_at)
--   values ('WELCOME2026', 1, null);
--
-- max_redemptions lets the same code work for either a single gift (1) or
-- a multi-use promo campaign (e.g. 50). expires_at is optional.
--
-- Run this ONCE in the Supabase dashboard. Depends on membership_schema.sql
-- (the profiles.membership_tier column) already existing. Safe to re-run.

create table if not exists public.premium_codes (
  code text primary key,
  max_redemptions integer not null default 1,
  redemption_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.premium_codes enable row level security;

-- Deliberately no policies for regular members at all - same reasoning as
-- friend_codes in friends_schema.sql: redemption goes entirely through
-- redeem_premium_code() below (SECURITY DEFINER, bypasses RLS), so this
-- table stays otherwise completely unreadable/unwritable by anyone but the
-- project owner creating codes directly in the SQL editor.

-- Only actually consumes the code (increments redemption_count) if the
-- caller was genuinely upgraded by it - an admin or already-Premium account
-- testing a limited-use gift code shouldn't burn a redemption for nothing.
create or replace function public.redeem_premium_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code record;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select * into v_code
    from public.premium_codes
    where code = upper(trim(p_code))
    for update;

  if not found then
    raise exception 'That code is not valid.';
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'That code has expired.';
  end if;

  if v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'That code has already been used.';
  end if;

  update public.profiles
    set membership_tier = 'premium'
    where user_id = v_uid and membership_tier = 'free';

  if not found then
    raise exception 'You already have Premium.';
  end if;

  update public.premium_codes
    set redemption_count = redemption_count + 1
    where code = v_code.code;
end;
$$;

revoke all on function public.redeem_premium_code(text) from public;
grant execute on function public.redeem_premium_code(text) to authenticated;
