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
 */
export async function registerClient(input: {
  clientName?: string;
  redirectUris: string[];
}): Promise<OAuthClient> {
  const clientId = randomBytes(16).toString("hex");
  const admin = createAdminClient();

  const { error } = await admin.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: input.clientName ?? null,
    redirect_uris: input.redirectUris,
  });

  if (error) throw new Error(error.message);

  return { clientId, clientName: input.clientName ?? null, redirectUris: input.redirectUris };
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
