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
export async function registerClient(input: {
  clientName?: string;
  redirectUris: string[];
}): Promise<OAuthClient> {
  const clientName = input.clientName ?? null;
  const admin = createAdminClient();

  let existingQuery = admin
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("redirect_uris", input.redirectUris);
  existingQuery =
    clientName === null ? existingQuery.is("client_name", null) : existingQuery.eq("client_name", clientName);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return { clientId: existing.client_id, clientName: existing.client_name, redirectUris: existing.redirect_uris };
  }

  const clientId = randomBytes(16).toString("hex");
  const { error } = await admin.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: input.redirectUris,
  });

  if (error) throw new Error(error.message);

  return { clientId, clientName, redirectUris: input.redirectUris };
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
