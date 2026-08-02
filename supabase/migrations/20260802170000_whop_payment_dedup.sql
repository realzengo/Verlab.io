-- Whop's payment.succeeded webhook was found to have never been delivered
-- for a real subscription purchase (payment paid, membership active on
-- Whop's side, but zero corresponding row ever landed in
-- whop_webhook_events) -- webhook delivery is not guaranteed, so credit
-- grants can no longer depend on it alone. A reconciliation path
-- (/api/checkout/reconcile) now double-checks Whop directly after checkout
-- as a fallback when the webhook hasn't landed yet.
--
-- Both paths must be able to run for the same underlying payment without
-- double-granting credits. whop_webhook_events already dedupes by webhook
-- *delivery* id, but that's useless for a reconciliation call (there is no
-- delivery) and wouldn't catch a redelivery under a different delivery id
-- either. This table dedupes on the stable Whop *payment* id instead, and
-- is checked by both code paths before granting credits.
create table public.whop_processed_payments (
  payment_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  credits_granted integer not null,
  source text not null check (source in ('webhook', 'reconcile')),
  created_at timestamptz not null default now()
);

alter table public.whop_processed_payments enable row level security;

comment on table public.whop_processed_payments is
  'Dedup guard for Whop credit grants, keyed by the payment''s own id (stable '
  'across redeliveries and reconciliation) rather than webhook delivery id. '
  'Insert with ON CONFLICT (payment_id) DO NOTHING before granting credits; '
  '0 rows affected means already processed, skip the grant.';
