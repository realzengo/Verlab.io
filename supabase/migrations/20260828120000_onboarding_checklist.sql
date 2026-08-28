-- Dashboard onboarding checklist: lets a user dismiss the card once they've
-- explored the product (or don't want it), independent of step completion
-- (which is derived on read from existing per-tool tables, not stored here).
alter table public.profiles add column onboarding_dismissed_at timestamptz;
