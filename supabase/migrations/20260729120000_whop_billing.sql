-- Switches active billing from Polar to Whop after Polar repeatedly denied
-- payment access (video downloader, then AI image generation, both content-
-- category policy rejections rather than fixable bugs). Polar's columns/
-- tables/routes are left in place unused rather than removed, in case Polar
-- is revisited later -- see src/lib/config/polar.ts.

-- profiles.subscription_status previously only allowed Polar's vocabulary.
-- Widened to the union of Polar's and Whop's MembershipStatus values rather
-- than translating Whop's statuses down to Polar's -- proxy.ts's paywall
-- gate only branches on 'active' | 'trialing' | 'past_due' (exact matches in
-- both vendors' vocabularies), so every other Whop status correctly falls
-- through to "no access" without any code changes there.
alter table public.profiles drop constraint profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in (
    -- Polar
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused',
    -- Whop (MembershipStatus)
    'completed', 'expired', 'unresolved', 'drafted', 'canceling'
  ));

-- Whop gives a per-membership hosted management URL directly on the
-- membership object (no separate "create a portal session" API call the way
-- Polar's customerSessions.create() needed) -- stored here so
-- /api/billing/portal can just read it back instead of calling Whop.
alter table public.profiles add column whop_manage_url text;

comment on column public.profiles.whop_manage_url is
  'membership.manage_url from the most recent Whop membership webhook -- '
  'the hosted page where a customer can update payment method or cancel. '
  'Refreshed on every membership.* event since Whop may rotate it.';

-- Webhook idempotency for POST /api/webhooks/whop, same shape/purpose as
-- polar_webhook_events (see that table's comment).
create table public.whop_webhook_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.whop_webhook_events enable row level security;

comment on table public.whop_webhook_events is
  'Dedup log for POST /api/webhooks/whop. Insert with ON CONFLICT (id) DO '
  'NOTHING before processing; 0 rows affected means already-seen, return 200 '
  'without reprocessing. processed_at is set once handling completes.';
