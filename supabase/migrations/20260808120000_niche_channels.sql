-- Individual creator channels ingested for faceless verification (distinct
-- from `niches`, which tracks trending topics/formats, not specific
-- channels). Populated by ingestion + classified by the Gemini classifier in
-- lib/server/faceless-classifier.ts; served publicly via
-- /api/niches/faceless once verified.
create table public.niche_channels (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube','tiktok')),
  channel_url text not null,
  channel_title text not null,
  channel_description text not null default '',
  avatar_url text,
  subscriber_count bigint not null default 0,
  total_views bigint not null default 0,
  niche text,
  visual_tags text[] not null default '{}',
  -- Recent video titles/descriptions fed to the classifier, e.g.
  -- [{"title": "...", "description": "..."}, ...] (up to 10).
  recent_videos jsonb not null default '[]',

  -- Populated once classifyAndStoreChannel() runs; null means "not yet classified".
  is_faceless boolean,
  faceless_confidence numeric check (faceless_confidence between 0 and 100),
  faceless_category text check (faceless_category in
    ('2D Animation','3D Animation','Whiteboard','Stock Footage','AI Pictures','Screen Recording','Documentary')),
  complexity text check (complexity in ('EASY','MEDIUM','HARD','LEGENDARY')),
  viral_velocity_score numeric check (viral_velocity_score between 0 and 100),
  classification_reasoning text,
  verified_at timestamptz,

  created_at timestamptz not null default now()
);

alter table public.niche_channels enable row level security;

-- Mirrors the public filter rules in faceless-queries.ts (defense in depth --
-- the query module applies these same predicates explicitly).
create policy "Authenticated users can read verified faceless channels"
  on public.niche_channels for select
  to authenticated
  using (is_faceless = true and faceless_confidence >= 85);

create unique index niche_channels_channel_url_idx on public.niche_channels (channel_url);
create index niche_channels_faceless_idx on public.niche_channels (is_faceless, faceless_confidence);
create index niche_channels_viral_velocity_idx on public.niche_channels (viral_velocity_score desc);
create index niche_channels_created_at_idx on public.niche_channels (created_at desc);
create index niche_channels_total_views_idx on public.niche_channels (total_views desc);
create index niche_channels_niche_idx on public.niche_channels (niche);
