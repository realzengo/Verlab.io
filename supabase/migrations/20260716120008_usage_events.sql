-- Single source of truth for real tool-usage analytics (replaces mock
-- USAGE_SERIES / TOOL_USAGE_SHARE / per-user AdminUser.usage). No RLS
-- policies granted to anon/authenticated: only server routes (service-role)
-- write a row when a job starts, and only admin routes (service-role)
-- aggregate over it, so users can't fake or inspect their own usage.
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (tool in ('bend','niches','transcripts','downloader','mcp')),
  event text not null default 'run',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

create index usage_events_tool_created_at_idx on public.usage_events (tool, created_at);
create index usage_events_user_id_created_at_idx on public.usage_events (user_id, created_at);
