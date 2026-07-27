create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code varchar not null unique,
  reward_type varchar not null check (reward_type in ('credits', 'discount_percent')),
  reward_value integer not null check (reward_value > 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promo_codes_code_uppercase check (code = upper(code))
);

alter table public.promo_codes enable row level security;
-- Service-role only (no RLS grants): admin CRUD goes through
-- /api/admin/promo-codes; redemption goes through redeem_promo_code() below.

create index promo_codes_code_idx on public.promo_codes (code);

-- Atomically validates + increments used_count in one statement so two
-- concurrent redemptions of a near-exhausted code can't both succeed (same
-- rationale as deduct_credits() in 20260722120001_credits_system.sql). Raises
-- the exact user-facing message src/lib/server/promo-codes.ts re-throws
-- verbatim.
create or replace function public.redeem_promo_code(p_code text)
returns table (reward_type text, reward_value integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.promo_codes%rowtype;
begin
  update public.promo_codes
  set used_count = used_count + 1
  where upper(code) = upper(p_code)
    and is_active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  returning * into v_row;

  if v_row.id is null then
    -- Distinguish "doesn't qualify at all" from "found but exhausted" so the
    -- caller gets the right one of the two spec'd error messages.
    if exists (
      select 1 from public.promo_codes
      where upper(code) = upper(p_code) and is_active = true
        and (expires_at is null or expires_at > now())
    ) then
      raise exception 'Promo code fully claimed.';
    else
      raise exception 'Invalid or expired promo code.';
    end if;
  end if;

  return query select v_row.reward_type, v_row.reward_value;
end;
$$;

revoke execute on function public.redeem_promo_code(text) from anon, authenticated;
