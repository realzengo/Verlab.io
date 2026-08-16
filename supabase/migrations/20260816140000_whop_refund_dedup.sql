-- Dedup guard for refund credit clawbacks, mirroring
-- whop_processed_payments (20260802170000_whop_payment_dedup.sql) but keyed
-- on the refund's own id instead of the payment's. whop_webhook_events
-- already dedupes by webhook *delivery* id, which doesn't protect against a
-- second, genuinely distinct refund.created event on the same payment (e.g.
-- two partial refunds) -- src/lib/server/whop-sync.ts's handleRefundCreated
-- used to derive the clawback from the payment's cumulative refunded_amount,
-- which re-clawed the full running total on every subsequent refund event
-- instead of just that event's own amount. This table is the same
-- insert-before-mutate belt-and-braces the payment path already has, in
-- case a delivery is ever redelivered under a new delivery id.
create table public.whop_processed_refunds (
  refund_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  credits_clawed integer not null,
  created_at timestamptz not null default now()
);

alter table public.whop_processed_refunds enable row level security;

comment on table public.whop_processed_refunds is
  'Dedup guard for Whop refund clawbacks, keyed by the refund''s own id. '
  'Insert with ON CONFLICT (refund_id) DO NOTHING before deducting credits; '
  '0 rows affected means already processed, skip the clawback.';
