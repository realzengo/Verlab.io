-- The claimed-niches dashboard promises creators their locked bends stay
-- private (see the landing page's "Claimed niches stay private" badge), but
-- the original select policy let any authenticated user read every row —
-- the app-level query has been scoped to the viewer, and this closes the
-- same gap at the RLS layer so it can't be bypassed by a direct client read.
drop policy "Authenticated users can read claimed niches" on public.niche_claims;

create policy "Users can read their own claimed niches"
  on public.niche_claims for select
  to authenticated
  using (user_id = auth.uid());
