-- Cross-user niche exclusivity: once a creator finalizes a niche bend (i.e.
-- generates the SOP for it), that niche is locked platform-wide so no other
-- user can be handed the same bend. The unique constraint on niche_key is
-- the actual lock — "first writer wins" — enforced atomically by Postgres,
-- not by an app-level check-then-write race.
create table public.niche_claims (
  id uuid primary key default gen_random_uuid(),
  niche_key text not null unique,
  niche_name text not null,
  angle text not null,
  example_titles jsonb not null default '[]'::jsonb,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.niche_bend_jobs(id) on delete set null,
  channel_name text,
  avatar_url text,
  platform text not null check (platform in ('youtube','tiktok')),
  created_at timestamptz not null default now()
);

alter table public.niche_claims enable row level security;

-- The claimed-niches showcase is a public "wall of fame" every signed-in
-- user can browse (that's the whole point — it signals scarcity). Writes are
-- intentionally not covered by any insert/update/delete policy: they only
-- ever happen through the service-role client in niche-bend-claims.ts, so
-- the unique constraint above can be relied on as an atomic lock.
create policy "Authenticated users can read claimed niches"
  on public.niche_claims for select
  to authenticated
  using (true);

create index niche_claims_created_at_idx on public.niche_claims (created_at desc);
create index niche_claims_user_id_idx on public.niche_claims (user_id, created_at desc);
