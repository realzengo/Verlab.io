-- Without this, DELETE from niche_bend_jobs matches zero rows under RLS
-- (no error raised), so the history "Delete" button appears to succeed
-- but the row survives and reappears on refetch.
create policy "Users can delete own niche bend jobs"
  on public.niche_bend_jobs for delete
  using (auth.uid() = user_id);
