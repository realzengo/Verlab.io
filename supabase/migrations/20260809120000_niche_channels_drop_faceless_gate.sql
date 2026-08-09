-- Removes the is_faceless/faceless_confidence gate from the public read
-- policy on niche_channels. Ingestion no longer runs channels through
-- Gemini classification automatically (see the api/admin/niches/ingest-tiktok
-- and ingest-youtube routes) -- keeping the old gate would leave the Niche
-- Finder page permanently empty, since is_faceless would never get set on
-- new rows. Manual classification (per-channel "Auto-Classify" or "Batch
-- Classify" in the admin UI) is still available and still populates
-- faceless_category/complexity/etc. for display -- it's just no longer a
-- requirement for visibility.
drop policy if exists "Authenticated users can read verified faceless channels" on public.niche_channels;

create policy "Authenticated users can read niche channels"
  on public.niche_channels for select
  to authenticated
  using (true);
