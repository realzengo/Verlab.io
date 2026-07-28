-- New signups no longer get 50 free credits -- /app is now paywalled
-- entirely (see proxy.ts), so a free balance had no gated use anyway, and
-- the product now requires a purchase before any credits exist. Only
-- changes the default for FUTURE signups; deliberately does not touch
-- existing profiles.credits balances already granted under the old default.
alter table public.profiles
  alter column credits set default 0;
