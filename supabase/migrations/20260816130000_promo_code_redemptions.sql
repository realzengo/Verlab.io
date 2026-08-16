-- Per-user redemption ledger for promo codes (see 20260725150000_promo_codes.sql).
-- redeem_promo_code() previously only checked is_active/expires_at/
-- used_count < max_uses -- nothing prevented the same user from calling it
-- repeatedly, redeeming the same code an unlimited number of times.

create table public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_type text not null,
  reward_value integer not null,
  created_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

alter table public.promo_code_redemptions enable row level security;
-- Service-role only for writes (via redeem_promo_code() below, SECURITY
-- DEFINER); users can read their own redemption history.

create policy "Users can view own promo redemptions"
  on public.promo_code_redemptions for select
  using (auth.uid() = user_id);

create index promo_code_redemptions_user_id_idx on public.promo_code_redemptions (user_id);

comment on table public.promo_code_redemptions is
  'One row per successful (promo_code_id, user_id) redemption -- the unique '
  'constraint is what actually prevents a user from redeeming the same code '
  'twice, enforced inside redeem_promo_code() below.';

-- Different parameter list than the existing 1-arg version, so drop it first
-- (same reasoning as deduct_credits() in 20260723120000_credit_system_extensions.sql
-- -- otherwise Postgres creates an additional overloaded function instead of
-- replacing it).
drop function if exists public.redeem_promo_code(text);

create or replace function public.redeem_promo_code(p_code text, p_user_id uuid)
returns table (reward_type text, reward_value integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.promo_codes%rowtype;
begin
  -- Lock the code row up front so a concurrent redemption of the same code
  -- (by this user or another) can't race past the checks below -- the lock
  -- is held until this function's implicit transaction commits/rolls back.
  select * into v_row from public.promo_codes where upper(code) = upper(p_code) for update;

  if v_row.id is null or v_row.is_active = false or (v_row.expires_at is not null and v_row.expires_at <= now()) then
    raise exception 'Invalid or expired promo code.';
  end if;

  if exists (
    select 1 from public.promo_code_redemptions
    where promo_code_id = v_row.id and user_id = p_user_id
  ) then
    raise exception 'You''ve already redeemed this code.';
  end if;

  if v_row.max_uses is not null and v_row.used_count >= v_row.max_uses then
    raise exception 'Promo code fully claimed.';
  end if;

  update public.promo_codes set used_count = used_count + 1 where id = v_row.id;

  insert into public.promo_code_redemptions (promo_code_id, user_id, reward_type, reward_value)
  values (v_row.id, p_user_id, v_row.reward_type, v_row.reward_value);

  return query select v_row.reward_type, v_row.reward_value;
end;
$$;

revoke execute on function public.redeem_promo_code(text, uuid) from anon, authenticated;
