-- The generate-image route was reworked (see 20260721120001) to insert a
-- `generating` row and update it to `completed`/`failed` from a background
-- `after()` call, using the same user-scoped, RLS-bound client as the rest
-- of the request. But the original table only ever had select/insert/delete
-- policies (it used to be write-once), so that background UPDATE was
-- silently blocked by RLS -- rows got stuck at status='generating' forever,
-- the client polled indefinitely, and every retry burned a real (billed)
-- fal.ai call whose result never became visible. Mirrors the update policy
-- niche_bend_jobs already has for the same after()-updates-its-own-row
-- pattern.
create policy "Users can update own image generations"
  on public.image_generations for update
  using (auth.uid() = user_id);

-- Rows orphaned by the missing policy above: their background job already
-- ran, tried to update, was silently blocked, and has long since exited --
-- nothing will ever move them out of `generating`. Mark them failed so they
-- stop being picked up by the client's auto-resume-polling on load.
update public.image_generations
set status = 'failed', error_message = 'Generation timed out.'
where status = 'generating';
