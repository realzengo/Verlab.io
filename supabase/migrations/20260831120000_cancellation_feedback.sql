-- In-app cancellation flow (Settings > Subscription > Cancel subscription):
-- a short exit survey plus one retention offer, replacing the old behavior
-- of immediately handing the user off to Whop's hosted portal. Whop's own
-- Membership.cancel_option/cancellation_reason fields are read-only (set by
-- Whop's hosted cancel UI, not settable through the API), so this table is
-- our own record of *why* someone tried to cancel and whether the retention
-- offer worked -- the cancellation itself still goes through
-- memberships.cancel() so billing state stays authoritative in Whop.
create table public.cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id text,
  plan text,
  reason text not null check (reason in ('too_expensive', 'switching', 'missing_features', 'technical_issues', 'bad_experience', 'other')),
  reason_detail text check (char_length(reason_detail) <= 2000),
  additional_feedback text check (char_length(additional_feedback) <= 2000),
  offer_shown boolean not null default false,
  offer_accepted boolean not null default false,
  free_days_granted integer not null default 0,
  outcome text not null check (outcome in ('retained', 'canceled')),
  created_at timestamptz not null default now()
);

create index cancellation_feedback_user_id_idx on public.cancellation_feedback (user_id);
create index cancellation_feedback_created_at_idx on public.cancellation_feedback (created_at desc);

alter table public.cancellation_feedback enable row level security;

comment on table public.cancellation_feedback is
  'One row per completed cancellation-flow attempt (Settings > Subscription '
  '> Cancel subscription): the reason selected, free-text detail, whether '
  'the 7-free-days retention offer was shown/accepted, and the outcome. '
  'Written by POST /api/billing/cancel and POST /api/billing/cancel/offer '
  'via the service-role client only -- no RLS policies, same as '
  'whop_webhook_events.';
