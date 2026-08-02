import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OAuthClient {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
}

/**
 * Dynamic Client Registration (RFC 7591). Public client only -- no secret --
 * since Claude/ChatGPT register themselves with no prior server-specific
 * credential and PKCE (see codes.ts) covers the security requirement a
 * confidential client would otherwise provide.
 *
 * Idempotent by (client_name, redirect_uris): MCP clients like Claude re-run
 * DCR on every reconnect rather than caching the client_id they were issued,
 * so without this a single app would mint a fresh client_id -- and a fresh
 * row in the connected-apps list -- on every reconnect, and "Disconnect"
 * would only revoke the newest one while older client_ids kept working.
 */
// PostgREST's .eq() can't reliably filter a text[] column by a JS array, so
// the existing-client lookup fetches by client_name (indexed, cheap) and
// compares redirect_uris in JS instead.
async function findRegisteredClient(
  admin: ReturnType<typeof createAdminClient>,
  clientName: string | null,
  redirectUris: string[]
): Promise<OAuthClient | null> {
  let query = admin.from("mcp_oauth_clients").select("client_id, client_name, redirect_uris");
  query = clientName === null ? query.is("client_name", null) : query.eq("client_name", clientName);
  const { data } = await query;

  const match = (data ?? []).find(
    (row) =>
      row.redirect_uris.length === redirectUris.length &&
      row.redirect_uris.every((uri: string, i: number) => uri === redirectUris[i])
  );
  return match ? { clientId: match.client_id, clientName: match.client_name, redirectUris: match.redirect_uris } : null;
}

export async function registerClient(input: {
  clientName?: string;
  redirectUris: string[];
}): Promise<OAuthClient> {
  const clientName = input.clientName ?? null;
  const admin = createAdminClient();

  const existing = await findRegisteredClient(admin, clientName, input.redirectUris);
  if (existing) return existing;

  const clientId = randomBytes(16).toString("hex");
  const { error } = await admin.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: input.redirectUris,
  });

  if (!error) return { clientId, clientName, redirectUris: input.redirectUris };

  // Unique violation on (client_name, redirect_uris) means a concurrent
  // request just registered the same client -- reuse it instead of failing.
  if (error.code === "23505") {
    const raced = await findRegisteredClient(admin, clientName, input.redirectUris);
    if (raced) return raced;
  }

  throw new Error(error.message);
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) return null;
  return { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris };
}
