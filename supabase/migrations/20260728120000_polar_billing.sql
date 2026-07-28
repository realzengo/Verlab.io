-- Polar.sh billing: adds subscription/customer state to profiles, a webhook
-- idempotency table, and finally seeds plan_definitions.credits_per_period
-- (added at 0 in 20260723120000_credit_system_extensions.sql, explicitly
-- deferred there as "a product decision for later"). Credit amounts are
-- proportional to plan price at CREDIT_VALUE_USD = 0.015 (src/lib/config/
-- pricing.ts), rounded down to the nearest 50 for margin safety.

alter table public.profiles
  add column polar_customer_id text unique,
  add column subscription_id text,
  add column subscription_status text
    check (subscription_status in (
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )),
  add column subscription_period text check (subscription_period in ('monthly', 'yearly')),
  add column subscription_current_period_end timestamptz;

comment on column public.profiles.polar_customer_id is
  'Polar customer id, set on first checkout/webhook. Used to open the hosted '
  'customer portal and correlate webhook events -- looked up via '
  'externalCustomerId (this profile''s id) rather than passed from the client.';
comment on column public.profiles.subscription_status is
  'Mirrors Polar''s subscription.status. Drives SubscriptionTab.tsx copy '
  'without a live Polar API call on every page load; access actually ending '
  'is driven by the subscription.revoked webhook event, not this column alone.';
comment on column public.profiles.subscription_period is
  'monthly or yearly -- determines whether a renewal grants 1x or 12x '
  'plan_definitions.credits_per_period (see src/app/api/webhooks/polar).';

-- Webhook idempotency: Polar retries on any non-2xx response, so a
-- redelivered event must not double-grant credits. Service-role only -- no
-- anon/authenticated policies -- written exclusively via createAdminClient()
-- from the webhook route.
create table public.polar_webhook_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.polar_webhook_events enable row level security;

comment on table public.polar_webhook_events is
  'Dedup log for POST /api/webhooks/polar. Insert with ON CONFLICT (id) DO '
  'NOTHING before processing; 0 rows affected means already-seen, return 200 '
  'without reprocessing. processed_at is set once handling completes.';

-- Reconciles plan_definitions.credits_per_period (see rationale above).
update public.plan_definitions set credits_per_period = 1250 where id = 'core';
update public.plan_definitions set credits_per_period = 2600 where id = 'pro';
update public.plan_definitions set credits_per_period = 5900 where id = 'scale';
