-- Full RLS audit found every table in public already has RLS enabled, but
-- four had `using (true)` read policies. Two categories:
--
-- 1. niches, trending_videos, niche_channels: never queried by the browser
--    client -- every read site is server-side via the service-role client
--    (src/app/api/niches/*, src/lib/server/trending-videos.ts,
--    src/lib/server/faceless-*-discovery.ts, src/lib/server/niche-video-*.ts).
--    Dropping the policy leaves RLS enabled with zero policies, which is a
--    hard default-deny for the anon/authenticated roles -- service_role
--    (which bypasses RLS entirely, not via a permissive policy) is
--    unaffected and keeps working exactly as before.
drop policy if exists "Authenticated users can read niches" on public.niches;
drop policy if exists "Authenticated users can read trending videos" on public.trending_videos;
drop policy if exists "Authenticated users can read niche channels" on public.niche_channels;

-- 2. plan_definitions is the one exception: it has no owner column (it's
--    shared pricing/plan copy, identical for every user) and, unlike the
--    three tables above, IS read directly by the browser client from inside
--    the authenticated /app shell (src/components/settings/PlanTab.tsx,
--    dashboard/PaywallPricing.tsx, pricing/UpgradeModal.tsx all call
--    supabase.from("plan_definitions").select(...) with the anon key). A
--    per-row ownership check isn't meaningful for catalog data every user is
--    meant to see identically, so this keeps a read-all policy rather than
--    breaking the pricing/paywall UI -- but narrows the role from PUBLIC
--    (which included anon) to authenticated only, so a logged-out visitor
--    can no longer read it with just the anon key.
drop policy if exists "Anyone can read plan definitions" on public.plan_definitions;

create policy "Authenticated users can read plan definitions"
  on public.plan_definitions for select
  to authenticated
  using (true);

-- The following four tables all have a real user_id owner column but never
-- got a policy at all (RLS enabled, service_role-only by default). Each gets
-- read-only access to a user's own rows, matching the pattern already used
-- for credit_transactions. No insert/update/delete: every one of these is
-- system-recorded server-side, never user-editable.
create policy "Users can view own usage events"
  on public.usage_events for select
  using (auth.uid() = user_id);

create policy "Users can view own activity log entries"
  on public.activity_log for select
  using (auth.uid() = user_id);

create policy "Users can view own affiliate waitlist entry"
  on public.affiliate_waitlist for select
  using (auth.uid() = user_id);

create policy "Users can view own processed payments"
  on public.whop_processed_payments for select
  using (auth.uid() = user_id);

create policy "Users can view own processed refunds"
  on public.whop_processed_refunds for select
  using (auth.uid() = user_id);

-- admin_team, mcp_oauth_authorization_codes, and mcp_oauth_tokens also have
-- a user_id column but are deliberately left with zero policies (RLS
-- enabled, service_role-only) rather than given an owner-scoped select:
--  - admin_team: a user's own row here still reveals their admin/owner/
--    support role assignment -- privilege metadata, not personal data.
--  - mcp_oauth_authorization_codes / mcp_oauth_tokens: store code_hash /
--    access_token_hash / refresh_token_hash. Even scoped to the owning row,
--    exposing token material through a direct RLS read path is unusual
--    practice; the app already has a safe server-mediated read path for
--    this via GET /api/oauth/connections (src/app/api/oauth/connections),
--    which never returns the hashes themselves.
