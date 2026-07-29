-- Real OAuth 2.1 authorization server for the MCP connector (replaces the
-- api_keys-based secret-URL/header schemes). Public clients only (PKCE
-- required, no client_secret) since Claude/ChatGPT register themselves via
-- Dynamic Client Registration with no prior knowledge of a server-specific
-- credential. All three tables are server-only -- accessed exclusively via
-- the service-role client, never a user's own session -- so RLS is enabled
-- with no policies (default deny) rather than modeled per-user.

create table public.mcp_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

alter table public.mcp_oauth_clients enable row level security;

create table public.mcp_oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  scope text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mcp_oauth_authorization_codes enable row level security;

create index mcp_oauth_codes_hash_idx on public.mcp_oauth_authorization_codes (code_hash) where used_at is null;

create table public.mcp_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text,
  access_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mcp_oauth_tokens enable row level security;

create index mcp_oauth_tokens_access_hash_idx on public.mcp_oauth_tokens (access_token_hash) where revoked_at is null;
create index mcp_oauth_tokens_refresh_hash_idx on public.mcp_oauth_tokens (refresh_token_hash) where revoked_at is null;
create index mcp_oauth_tokens_user_idx on public.mcp_oauth_tokens (user_id) where revoked_at is null;
