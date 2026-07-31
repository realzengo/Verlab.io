-- Request-level instrumentation for the /admin/system dashboard (uptime,
-- API error rate, and per-endpoint health), previously all hardcoded
-- placeholders with "needs APM" copy. Two independent logs:
--   api_request_log -- one row per instrumented product/tool API + MCP
--   call, written by src/lib/server/api-logging.ts's withApiLogging
--   wrapper (and the MCP dispatch loop in src/lib/server/mcp/server.ts).
--   health_checks -- one row per run of the /api/cron/health-check cron
--   (every 5 min, see vercel.json), a synthetic self-ping since this stack
--   has no external uptime monitor. Uptime % is checks-ok / checks-total,
--   not derived from request traffic (a quiet period isn't downtime).
-- Both are service-role only -- no anon/authenticated policies -- written
-- exclusively via createAdminClient() from server-side code.

create table public.api_request_log (
  id bigint generated always as identity primary key,
  endpoint text not null,
  method text not null,
  status int not null,
  is_error boolean not null,
  duration_ms int not null,
  created_at timestamptz not null default now()
);

alter table public.api_request_log enable row level security;

create index api_request_log_created_at_idx on public.api_request_log (created_at);
create index api_request_log_endpoint_created_at_idx on public.api_request_log (endpoint, created_at);

comment on table public.api_request_log is
  'One row per instrumented product/tool API or MCP call -- endpoint is a '
  'route label (e.g. "/api/generate-image") or "mcp:<tool_name>" for MCP '
  'tool calls. Pruned to the trailing 35 days by the health-check cron.';

-- Synthetic uptime ping -- see rationale above.
create table public.health_checks (
  id bigint generated always as identity primary key,
  ok boolean not null,
  latency_ms int,
  error text,
  created_at timestamptz not null default now()
);

alter table public.health_checks enable row level security;

create index health_checks_created_at_idx on public.health_checks (created_at);

comment on table public.health_checks is
  'One row per /api/cron/health-check run (every 5 min). Uptime (30d) on '
  'the admin dashboard is ok=true rows / total rows in the last 30 days.';
