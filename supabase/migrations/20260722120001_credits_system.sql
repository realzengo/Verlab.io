-- Credits balance lives on profiles (already exists, see
-- 20260716120001_profiles.sql). Every signed-up user starts with 50 credits.
alter table public.profiles
  add column credits integer not null default 50;

alter table public.profiles
  add constraint profiles_credits_non_negative check (credits >= 0);

-- Ledger of every credit movement: negative rows are feature usage,
-- positive rows are top-ups/grants. No insert/update policy for
-- anon/authenticated — only the deduct_credits() function below (running
-- as its owner via SECURITY DEFINER) or a service-role top-up route may
-- write here, so users can't fabricate their own transaction history.
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  feature text not null,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;

create policy "Users can view own credit transactions"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

create index credit_transactions_user_id_created_at_idx
  on public.credit_transactions (user_id, created_at desc);

-- The existing "Users can update own profile" policy on profiles has no
-- column restriction, which would let any signed-in user grant themselves
-- credits directly (supabase.from('profiles').update({ credits: 999999 })).
-- Lock the table-level UPDATE grant down and re-grant only the columns a
-- user is allowed to self-edit. credits is deliberately excluded — it can
-- only change via deduct_credits() below (SECURITY DEFINER, runs as the
-- function owner, unaffected by these grants) or a service-role top-up.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Atomically checks balance, decrements it, and logs the transaction in one
-- statement, so two concurrent requests can never both succeed against the
-- same balance and drive credits negative (a plain "read balance, then
-- update" round trip from application code has that race).
create or replace function public.deduct_credits(p_user_id uuid, p_amount integer, p_feature text)
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

  insert into public.credit_transactions (user_id, amount, feature)
  values (p_user_id, -p_amount, p_feature);

  return new_balance;
end;
$$;
