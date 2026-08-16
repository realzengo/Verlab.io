-- Drops the Polar-only leftovers from 20260728120000_polar_billing.sql now
-- that billing is fully Whop (20260729120000_whop_billing.sql). Only the
-- genuinely Polar-only objects are touched here:
--
-- - profiles.polar_customer_id -- written exclusively by the now-deleted
--   /api/webhooks/polar route, read by nothing. Safe to drop; any value it
--   held was only ever useful for calling Polar's API, which no code does
--   anymore.
-- - public.polar_webhook_events -- webhook idempotency log for the deleted
--   Polar webhook route. Not read anywhere outside that route.
--
-- Everything else that migration added (subscription_id, subscription_status,
-- subscription_period, subscription_current_period_end) is actively written
-- by src/lib/server/whop-sync.ts and stays untouched -- those columns were
-- never Polar-branded, Whop just inherited the same shape.

drop table if exists public.polar_webhook_events;

alter table public.profiles
  drop column if exists polar_customer_id;
