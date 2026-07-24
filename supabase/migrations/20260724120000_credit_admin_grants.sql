-- Admin credit management (see 20260722120001_credits_system.sql and
-- 20260723120000_credit_system_extensions.sql for the base ledger + RPCs).
--
-- Adds:
--   1. credit_transactions.granted_by -- the admin email that made a manual
--      adjustment, for an audit trail on top-ups/removals. Null for
--      feature-charge rows (deduct_credits/refund_credits never set it).
--   2. admin_adjust_credits() -- a single SECURITY DEFINER RPC an admin can
--      call to either grant (positive delta) or remove (negative delta)
--      credits from a user, logging both the reason and the acting admin.
--      Negative deltas are floor-checked the same way deduct_credits() is
--      (never let a manual removal take a user below zero); positive deltas
--      have no ceiling. EXECUTE is revoked from anon/authenticated, same as
--      the other credit RPCs -- service-role (admin API routes) only.

alter table public.credit_transactions
  add column granted_by text;

comment on column public.credit_transactions.granted_by is
  'Email of the admin who made a manual credit adjustment via '
  'admin_adjust_credits(). Null for ordinary feature-charge/refund rows.';

create or replace function public.admin_adjust_credits(
  p_admin_email text,
  p_user_id uuid,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_delta = 0 then
    raise exception 'p_delta must be non-zero';
  end if;

  if p_delta > 0 then
    update public.profiles
    set credits = credits + p_delta
    where id = p_user_id
    returning credits into new_balance;
  else
    update public.profiles
    set credits = credits + p_delta
    where id = p_user_id and credits >= -p_delta
    returning credits into new_balance;
  end if;

  if new_balance is null then
    if p_delta < 0 then
      raise exception 'Insufficient credits';
    end if;
    raise exception 'User not found';
  end if;

  insert into public.credit_transactions (user_id, amount, feature, action_key, granted_by)
  values (p_user_id, p_delta, p_reason, 'admin.manual_adjustment', p_admin_email);

  return new_balance;
end;
$$;

revoke execute on function public.admin_adjust_credits(text, uuid, integer, text)
  from anon, authenticated;
