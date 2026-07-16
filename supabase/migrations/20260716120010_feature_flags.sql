create table public.feature_flags (
  id text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default false,
  rollout_pct int not null default 0 check (rollout_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.feature_flags enable row level security;
-- Service-role only (no RLS grants): admin/settings reads and toggles go
-- through /api/admin/feature-flags.

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row
  execute function public.set_updated_at();

insert into public.feature_flags (id, label, description, enabled, rollout_pct) values
  ('flag_niche_bend_v2', 'Niche Bending v2 pipeline', 'Route bend jobs through the new multi-step analysis pipeline.', true, 100),
  ('flag_mcp_public', 'Public MCP server', 'Allow unauthenticated MCP discovery for Claude/ChatGPT connectors.', false, 0),
  ('flag_downloader_mp3', 'MP3 audio downloads', 'Enable audio-only extraction in the media downloader.', true, 100),
  ('flag_scale_seats', 'Scale plan team seats', 'Multi-seat billing for the Scale tier.', false, 0),
  ('flag_ai_hook_rewrite', 'AI hook rewriter', 'One-click hook rewrite suggestions inside Script Maker.', false, 0),
  ('flag_export_xml', 'XML export', 'Export scripts/SOPs as XML for editing pipelines.', false, 0);
