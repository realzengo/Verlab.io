-- Drops profiles.onboarding_dismissed_at, added by
-- 20260828120000_onboarding_checklist.sql for the dashboard onboarding
-- checklist. The checklist and its /api/onboarding/dismiss route have been
-- removed, so nothing writes or reads this column anymore.
alter table public.profiles
  drop column if exists onboarding_dismissed_at;
