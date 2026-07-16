create table public.niches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null,
  faceless boolean not null default true,
  tags text[] not null default '{}',
  platform text not null default 'mixed' check (platform in ('tiktok','youtube','instagram','mixed')),
  momentum_score numeric not null,
  momentum_trend text not null check (momentum_trend in ('up','down','flat')),
  sample_videos jsonb not null default '[]',
  metadata jsonb not null default '{}',
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.niches enable row level security;

create policy "Authenticated users can read niches"
  on public.niches for select
  to authenticated
  using (true);

create index niches_momentum_score_idx on public.niches (momentum_score desc);

-- Observability log for the cron-triggered trend refresh (see api/niches/refresh).
create table public.niche_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed')),
  niches_upserted int not null default 0,
  error_message text
);

alter table public.niche_refresh_runs enable row level security;

-- Seed with today's static niche list so the page isn't empty before the
-- first automated refresh runs; the refresh pipeline upserts by slug from here on.
insert into public.niches (slug, name, category, description, faceless, tags, platform, momentum_score, momentum_trend, sample_videos) values
  ('medical-malpractice', 'Medical Malpractice', 'True crime',
   'Faceless breakdowns of real malpractice cases — the mistake, the coverup, the payout.',
   true, array['true crime','medical','faceless'], 'mixed', 94, 'up',
   '[{"id":"medmal-v1","thumbnailUrl":"/mock/thumbs/medmal-1.jpg","title":"The $2.3M mistake surgeons hope you never learn about","views":"4.2M"},{"id":"medmal-v2","thumbnailUrl":"/mock/thumbs/medmal-2.jpg","title":"Why this common ER shortcut kills 40 people a year","views":"3.1M"},{"id":"medmal-v3","thumbnailUrl":"/mock/thumbs/medmal-3.jpg","title":"The consent form loophole hospitals dont want you reading","views":"2.8M"}]'::jsonb),
  ('corporate-espionage', 'Corporate Espionage', 'Business',
   'Stories of leaked trade secrets, planted moles, and the takedowns that followed.',
   true, array['business','espionage','faceless'], 'mixed', 88, 'up',
   '[{"id":"corpespionage-v1","thumbnailUrl":"/mock/thumbs/corpespionage-1.jpg","title":"The intern who leaked a decade of trade secrets","views":"5.6M"},{"id":"corpespionage-v2","thumbnailUrl":"/mock/thumbs/corpespionage-2.jpg","title":"How a rivals mole sat in on every board meeting","views":"3.9M"},{"id":"corpespionage-v3","thumbnailUrl":"/mock/thumbs/corpespionage-3.jpg","title":"The patent filing that exposed the whole scheme","views":"2.4M"}]'::jsonb),
  ('financial-collapse', 'Financial Collapse', 'Business',
   'The trades, the warning signs, and the collapses that took entire institutions down.',
   true, array['finance','history','faceless'], 'mixed', 81, 'flat',
   '[{"id":"fincollapse-v1","thumbnailUrl":"/mock/thumbs/fincollapse-1.jpg","title":"The trade that erased a nations pension fund","views":"3.3M"},{"id":"fincollapse-v2","thumbnailUrl":"/mock/thumbs/fincollapse-2.jpg","title":"Every warning sign regulators chose to ignore","views":"2.1M"},{"id":"fincollapse-v3","thumbnailUrl":"/mock/thumbs/fincollapse-3.jpg","title":"How one bad bet took down a 150-year-old bank","views":"4.0M"}]'::jsonb),
  ('military-disasters', 'Military Disasters', 'History',
   'The battle plans, radio silences, and split-second decisions that doomed campaigns.',
   true, array['history','military','faceless'], 'mixed', 76, 'up',
   '[{"id":"mildisaster-v1","thumbnailUrl":"/mock/thumbs/mildisaster-1.jpg","title":"The battle plan that doomed 40,000 soldiers","views":"2.9M"},{"id":"mildisaster-v2","thumbnailUrl":"/mock/thumbs/mildisaster-2.jpg","title":"The radio silence that lost an entire war","views":"1.8M"},{"id":"mildisaster-v3","thumbnailUrl":"/mock/thumbs/mildisaster-3.jpg","title":"Every way generals have sent armies to slaughter","views":"3.5M"}]'::jsonb),
  ('cult-breakdowns', 'Cult Breakdowns', 'True crime',
   'How charismatic leaders built (and lost) total control over their followers.',
   true, array['true crime','psychology','faceless'], 'mixed', 72, 'up',
   '[{"id":"cultbreak-v1","thumbnailUrl":"/mock/thumbs/cultbreak-1.jpg","title":"The recruiting tactic that hooked 4,000 members","views":"2.2M"},{"id":"cultbreak-v2","thumbnailUrl":"/mock/thumbs/cultbreak-2.jpg","title":"The night the compound turned on itself","views":"1.6M"}]'::jsonb),
  ('unsolved-disappearances', 'Unsolved Disappearances', 'True crime',
   'Cold cases, the last known sighting, and the theories that never died.',
   true, array['true crime','mystery','faceless'], 'mixed', 69, 'down',
   '[{"id":"disappear-v1","thumbnailUrl":"/mock/thumbs/disappear-1.jpg","title":"The last text message before she vanished","views":"1.9M"},{"id":"disappear-v2","thumbnailUrl":"/mock/thumbs/disappear-2.jpg","title":"Every clue investigators missed for 12 years","views":"1.4M"}]'::jsonb),
  ('engineering-failures', 'Engineering Failures', 'Science',
   'The calculation errors and cut corners behind historys biggest collapses.',
   true, array['science','engineering','faceless'], 'mixed', 64, 'flat',
   '[{"id":"engfail-v1","thumbnailUrl":"/mock/thumbs/engfail-1.jpg","title":"The decimal point error that collapsed a bridge","views":"1.2M"},{"id":"engfail-v2","thumbnailUrl":"/mock/thumbs/engfail-2.jpg","title":"Why this skyscraper almost fell in a windstorm","views":"980K"}]'::jsonb)
on conflict (slug) do nothing;
