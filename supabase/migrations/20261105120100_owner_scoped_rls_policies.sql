-- Resets every RLS policy in public to one explicit, owner-scoped set.
--
-- Drops whatever policies exist first (including any added from the
-- dashboard that no migration knows about -- each one is logged as a NOTICE
-- so unexpected ones show up in the SQL editor output), enables RLS on every
-- table in the schema, then recreates only:
--   * full own-row CRUD on tables the app writes through the user-scoped
--     (RLS-respecting) server client,
--   * own-row SELECT only on ledgers/history the server writes with the
--     service role -- letting users "change their own rows" there would let
--     them edit their own credit history or payment records,
--   * no policy at all (deny every client) on global/internal tables that
--     have no owner column. The service role bypasses RLS, so server code
--     is unaffected.
-- Nothing uses USING (true). Policies are `to authenticated` so the anon
-- role never matches, and use `(select auth.uid())` so Postgres evaluates
-- it once per statement instead of once per row.
--
-- Behavior change: plan_definitions loses its read-all policy. The in-app
-- pricing UI now reads it via GET /api/plans (service role, cached), the
-- same source the landing page already renders from.

do $$
declare
  p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    raise notice 'dropping policy "%" on %', p.policyname, p.tablename;
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

do $$
declare
  t record;
  known text[] := array[
    'activity_log', 'admin_team', 'affiliate_waitlist', 'api_providers', 'api_request_log',
    'cancellation_feedback', 'creator_analyses', 'credit_transactions', 'downloads', 'feature_flags',
    'health_checks', 'image_generations', 'mcp_oauth_authorization_codes', 'mcp_oauth_clients',
    'mcp_oauth_tokens', 'niche_bend_jobs', 'niche_bend_research_cache', 'niche_channels', 'niche_claims',
    'niche_refresh_runs', 'niche_reports', 'niche_video_refresh_locks', 'niches', 'plan_definitions',
    'profiles', 'promo_code_redemptions', 'promo_codes', 'rate_limit_hits', 'saved_videos',
    'script_reference_files', 'scripts', 'tiktok_author_follower_cache', 'transcripts', 'trending_videos',
    'usage_events', 'user_avatars', 'video_generations', 'voice_clones', 'voiceover_generations',
    'whop_processed_payments', 'whop_processed_refunds', 'whop_webhook_events'
  ];
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    if not t.tablename = any(known) then
      raise notice 'table % is not in any migration -- RLS enabled, no policies (deny all clients)', t.tablename;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Own-row read + write (written via the user-scoped server client)
-- ---------------------------------------------------------------------------

create policy "Users can view own creator analyses" on public.creator_analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own creator analyses" on public.creator_analyses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own creator analyses" on public.creator_analyses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own creator analyses" on public.creator_analyses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own downloads" on public.downloads for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own downloads" on public.downloads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own downloads" on public.downloads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own downloads" on public.downloads for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own image generations" on public.image_generations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own image generations" on public.image_generations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own image generations" on public.image_generations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own image generations" on public.image_generations for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own niche bend jobs" on public.niche_bend_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own niche bend jobs" on public.niche_bend_jobs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own niche bend jobs" on public.niche_bend_jobs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own niche bend jobs" on public.niche_bend_jobs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own niche reports" on public.niche_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own niche reports" on public.niche_reports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own niche reports" on public.niche_reports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own niche reports" on public.niche_reports for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own script reference files" on public.script_reference_files for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own script reference files" on public.script_reference_files for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own script reference files" on public.script_reference_files for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own script reference files" on public.script_reference_files for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own scripts" on public.scripts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own scripts" on public.scripts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own scripts" on public.scripts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own scripts" on public.scripts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own transcripts" on public.transcripts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own transcripts" on public.transcripts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own transcripts" on public.transcripts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own transcripts" on public.transcripts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own video generations" on public.video_generations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own video generations" on public.video_generations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own video generations" on public.video_generations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own video generations" on public.video_generations for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own voiceover generations" on public.voiceover_generations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own voiceover generations" on public.voiceover_generations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own voiceover generations" on public.voiceover_generations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own voiceover generations" on public.voiceover_generations for delete to authenticated using ((select auth.uid()) = user_id);

-- Insert/delete only -- rows are never edited in place.
create policy "Users can view own saved videos" on public.saved_videos for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can save videos" on public.saved_videos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can unsave own videos" on public.saved_videos for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own avatars" on public.user_avatars for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own avatars" on public.user_avatars for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete own avatars" on public.user_avatars for delete to authenticated using ((select auth.uid()) = user_id);

-- 20260907120000_voice_clones.sql hadn't been applied live as of 2026-11-05,
-- so only touch the table if it exists.
do $$
begin
  if to_regclass('public.voice_clones') is not null then
    execute 'create policy "Users can view own voice clones" on public.voice_clones for select to authenticated using ((select auth.uid()) = user_id)';
    execute 'create policy "Users can create own voice clones" on public.voice_clones for insert to authenticated with check ((select auth.uid()) = user_id)';
    execute 'create policy "Users can delete own voice clones" on public.voice_clones for delete to authenticated using ((select auth.uid()) = user_id)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Own-row read only (server writes with the service role)
-- ---------------------------------------------------------------------------

create policy "Users can view own activity log entries" on public.activity_log for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own affiliate waitlist entry" on public.affiliate_waitlist for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own credit transactions" on public.credit_transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read their own claimed niches" on public.niche_claims for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own promo redemptions" on public.promo_code_redemptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own usage events" on public.usage_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own processed payments" on public.whop_processed_payments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own processed refunds" on public.whop_processed_refunds for select to authenticated using ((select auth.uid()) = user_id);

-- profiles is keyed by id = auth.users.id. The update policy only picks the
-- row; the column grant from 20260722120001_credits_system.sql limits what
-- authenticated can actually write to full_name (never credits/plan/billing).
create policy "Users can view own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- No client policies (RLS on, deny all; service role only):
--   admin_team, api_providers, api_request_log, cancellation_feedback,
--   feature_flags, health_checks, mcp_oauth_authorization_codes,
--   mcp_oauth_clients, mcp_oauth_tokens, niche_bend_research_cache,
--   niche_channels, niche_refresh_runs, niche_video_refresh_locks, niches,
--   plan_definitions, promo_codes, rate_limit_hits,
--   tiktok_author_follower_cache, trending_videos, whop_webhook_events
-- ---------------------------------------------------------------------------
