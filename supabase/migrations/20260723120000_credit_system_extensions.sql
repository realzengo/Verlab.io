-- Extends the credit system (see 20260722120001_credits_system.sql) with:
--   1. A machine-readable action_key column on credit_transactions, for
--      precise margin/analytics tracking, alongside the existing free-text
--      `feature` label (kept as-is for human-readable display).
--   2. deduct_credits() extended with an optional p_action_key param that
--      persists onto the ledger row.
--   3. A new refund_credits() function (SECURITY DEFINER, symmetric to
--      deduct_credits) so routes that charge before calling a third-party
--      API can make a user whole on a hard failure.
--   4. plan_definitions.credits_per_period, so the existing admin-editable
--      plan copy table can also drive future recurring credit grants.
--
-- SECURITY FIX (pre-existing gap, not introduced by this migration):
-- deduct_credits() had no REVOKE EXECUTE, so Postgres' default PUBLIC grant
-- meant ANY authenticated user could call
--   supabase.rpc('deduct_credits', { p_user_id: <victim>, ... })
-- directly from their own session and drain someone else's balance. This
-- migration revokes EXECUTE from anon/authenticated on both credit RPCs --
-- they are meant to be called only from trusted server code via the
-- service-role (admin) client, which is unaffected by this revoke.

alter table public.credit_transactions
  add column action_key text;

comment on column public.credit_transactions.action_key is
  'Machine-readable pricing.ts config key for this transaction (e.g. '
  '"image.nano_banana_pro", "niche_bend.analyze_scrape", "script.generation"). '
  'Null for legacy rows written before this column existed, or for '
  'transactions not tied to a specific metered action (manual top-ups).';

create index credit_transactions_action_key_created_at_idx
  on public.credit_transactions (action_key, created_at desc)
  where action_key is not null;

-- Drop before recreate: a different parameter list would otherwise create an
-- ADDITIONAL overloaded function alongside the old 3-arg one (Postgres
-- functions are overloaded by signature), which is not what we want here.
drop function if exists public.deduct_credits(uuid, integer, text);

create or replace function public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_feature text,
  p_action_key text default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  update public.profiles
  set credits = credits - p_amount
  where id = p_user_id and credits >= p_amount
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'Insufficient credits';
  end if;

  insert into public.credit_transactions (user_id, amount, feature, action_key)
  values (p_user_id, -p_amount, p_feature, p_action_key);

  return new_balance;
end;
$$;

revoke execute on function public.deduct_credits(uuid, integer, text, text)
  from anon, authenticated;

-- Symmetric "add credits back" function for charge-before-call routes so a
-- hard third-party failure doesn't strand the user paying for nothing. No
-- balance floor check needed (adding can't go negative); still SECURITY
-- DEFINER + logged the same way, for the same auditability.
create or replace function public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_feature text,
  p_action_key text default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'User not found';
  end if;

  insert into public.credit_transactions (user_id, amount, feature, action_key)
  values (p_user_id, p_amount, p_feature, p_action_key);

  return new_balance;
end;
$$;

revoke execute on function public.refund_credits(uuid, integer, text, text)
  from anon, authenticated;

-- Forward-compatible column for a future billing/webhook handler to read
-- when granting recurring credits on plan renewal. src/lib/config/pricing.ts
-- SUBSCRIPTION_PLANS is the seed/reference data; this column is the runtime
-- source of truth for the actual grant amount once billing exists. NOT
-- reconciled with the existing core/pro/scale rows' naming or pricing --
-- that is a product decision, not made by this migration.
alter table public.plan_definitions
  add column credits_per_period integer not null default 0;

comment on column public.plan_definitions.credits_per_period is
  'Credits granted to a subscriber on this plan per billing cycle. 0 for '
  'plans with no recurring credit grant (the current core/pro/scale rows '
  'default to 0 until a product decision reconciles them with the new '
  'Free/Creator/Pro credit plans in src/lib/config/pricing.ts).';
