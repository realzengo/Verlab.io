-- Fast lookup for MCP connector auth: every MCP request hashes the token
-- from its URL and looks up the matching active row by key_hash.
create index api_keys_key_hash_idx on public.api_keys (key_hash) where revoked_at is null;
