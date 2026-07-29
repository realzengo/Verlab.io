import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvalidGrantError } from "./codes";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string | null;
}

export async function issueTokenPair(input: {
  clientId: string;
  userId: string;
  scope?: string | null;
}): Promise<TokenPair> {
  const accessToken = randomBytes(32).toString("base64url");
  const refreshToken = randomBytes(32).toString("base64url");
  const admin = createAdminClient();

  const { error } = await admin.from("mcp_oauth_tokens").insert({
    access_token_hash: hash(accessToken),
    refresh_token_hash: hash(refreshToken),
    client_id: input.clientId,
    user_id: input.userId,
    scope: input.scope ?? null,
    access_expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString(),
  });

  if (error) throw new Error(error.message);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
    scope: input.scope ?? null,
  };
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; clientId: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("mcp_oauth_tokens")
    .select("user_id, client_id")
    .eq("access_token_hash", hash(token))
    .is("revoked_at", null)
    .gt("access_expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return null;
  return { userId: data.user_id, clientId: data.client_id };
}

/**
 * Rotates a refresh token: atomically claims+revokes the old row (the
 * UPDATE ... WHERE revoked_at IS NULL ... RETURNING below can only ever
 * succeed once per token, so a replayed refresh_token can't mint a second
 * pair) then issues a fresh access/refresh pair for the same client+user.
 */
export async function rotateRefreshToken(refreshToken: string): Promise<TokenPair> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("refresh_token_hash", hash(refreshToken))
    .is("revoked_at", null)
    .select("client_id, user_id, scope")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new InvalidGrantError("Invalid or already-used refresh token");

  return issueTokenPair({ clientId: data.client_id, userId: data.user_id, scope: data.scope });
}

export interface OAuthConnection {
  clientId: string;
  clientName: string | null;
}

export async function listConnections(userId: string): Promise<OAuthConnection[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_oauth_tokens")
    .select("client_id, mcp_oauth_clients(client_name)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) throw new Error(error.message);

  const seen = new Map<string, OAuthConnection>();
  for (const row of data ?? []) {
    const client = row.mcp_oauth_clients as unknown as { client_name: string | null } | null;
    seen.set(row.client_id, { clientId: row.client_id, clientName: client?.client_name ?? null });
  }
  return [...seen.values()];
}

export async function revokeConnection(userId: string, clientId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .is("revoked_at", null);

  if (error) throw new Error(error.message);
}
