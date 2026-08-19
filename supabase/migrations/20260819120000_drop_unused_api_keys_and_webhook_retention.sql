-- Removes the api_keys table: designed as a hashed-secret store
-- (key_prefix + key_hash, never a raw key column) but never wired into any
-- application code -- superseded by the OAuth 2.1 server in
-- mcp_oauth_tokens before anything ever wrote to it (see that table's own
-- comment in 20260729152048_mcp_oauth.sql). Unused tables modeling secrets
-- are their own small risk: a future feature could get built against it
-- without noticing the hashing convention needs care, or it could get
-- mistaken for a live credential store during a security review. Confirmed
-- zero references anywhere in src/ before dropping.
drop table if exists public.api_keys;

-- whop_webhook_events.payload stores the complete raw Whop webhook object,
-- which embeds customer PII (name, email, billing metadata) inside Whop's
-- JSON -- see parseRevenueTransaction in src/lib/server/admin-queries.ts,
-- which reads exactly that back out for the admin revenue dashboard. RLS
-- already restricts the table to service_role (no anon/authenticated
-- policy -- see the original migration comment), so this isn't about
-- access control -- it's about not holding another company's customer PII
-- forever with no retention bound.
--
-- payload_redacted_at tracks when a row's payload was scrubbed by the
-- redact-webhook-payloads cron (src/app/api/cron/redact-webhook-payloads).
-- id/type/created_at/processed_at are untouched by redaction, so webhook
-- delivery dedup (ON CONFLICT (id) DO NOTHING) and the historical event
-- timeline keep working forever -- only the embedded customer PII has a
-- retention window.
alter table public.whop_webhook_events add column payload_redacted_at timestamptz;

-- Keeps the cron's "not yet redacted, past the cutoff" scan cheap as the
-- table grows -- redacted rows drop out of this index immediately.
create index whop_webhook_events_unredacted_idx
  on public.whop_webhook_events (created_at)
  where payload_redacted_at is null;
