-- Before registerClient() became idempotent, MCP clients (Claude, ChatGPT)
-- minted a fresh client_id on every reconnect instead of reusing one,
-- producing several mcp_oauth_clients rows -- and several "Connected apps"
-- entries -- for what a user experienced as a single connection, with
-- "Disconnect" only revoking the one row they clicked. This consolidates
-- pre-existing duplicates onto a single canonical client_id per
-- (client_name, redirect_uris) group so the UI shows one row and
-- disconnecting it revokes every token issued under any of the duplicates.

with grouped as (
  select
    client_id,
    first_value(client_id) over (
      partition by coalesce(client_name, ''), redirect_uris
      order by created_at, client_id
    ) as canonical_client_id
  from public.mcp_oauth_clients
),
duplicates as (
  select client_id, canonical_client_id
  from grouped
  where client_id <> canonical_client_id
)
update public.mcp_oauth_tokens t
set client_id = d.canonical_client_id
from duplicates d
where t.client_id = d.client_id;

with grouped as (
  select
    client_id,
    first_value(client_id) over (
      partition by coalesce(client_name, ''), redirect_uris
      order by created_at, client_id
    ) as canonical_client_id
  from public.mcp_oauth_clients
),
duplicates as (
  select client_id, canonical_client_id
  from grouped
  where client_id <> canonical_client_id
)
update public.mcp_oauth_authorization_codes c
set client_id = d.canonical_client_id
from duplicates d
where c.client_id = d.client_id;

with grouped as (
  select
    client_id,
    first_value(client_id) over (
      partition by coalesce(client_name, ''), redirect_uris
      order by created_at, client_id
    ) as canonical_client_id
  from public.mcp_oauth_clients
)
delete from public.mcp_oauth_clients
where client_id in (select client_id from grouped where client_id <> canonical_client_id);

-- Defense in depth: even if application-level idempotency in registerClient()
-- races, the database now refuses a second client_id for the same identity.
create unique index mcp_oauth_clients_identity_idx
  on public.mcp_oauth_clients (coalesce(client_name, ''), redirect_uris);
