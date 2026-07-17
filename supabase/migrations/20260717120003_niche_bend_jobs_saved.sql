-- Backs the "Save to my library" action on a finished SOP (src/components/features/niche-bend/StepSop.tsx),
-- which previously only toggled local component state and lost the save on refresh.
alter table public.niche_bend_jobs
  add column saved boolean not null default false;

create index niche_bend_jobs_user_saved_idx on public.niche_bend_jobs (user_id, saved, created_at desc);
