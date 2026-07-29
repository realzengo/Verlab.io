import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_BYTES = 32;
const LABEL = "MCP connector";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface McpTokenInfo {
  keyPrefix: string;
  createdAt: string;
}

/**
 * Whether the user already has an active MCP connector token, without ever
 * exposing the raw secret back (it's only ever shown once, at issuance).
 */
export async function getActiveMcpToken(userId: string): Promise<McpTokenInfo | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("key_prefix, created_at")
    .eq("user_id", userId)
    .eq("label", LABEL)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { keyPrefix: data.key_prefix, createdAt: data.created_at };
}

/**
 * Revokes any existing active MCP token and issues a fresh one. The raw
 * secret is returned once here and never persisted or retrievable again —
 * only its SHA-256 hash is stored, matching standard API-key hygiene. A user
 * who loses their connector URL has to regenerate a new one.
 */
export async function issueMcpToken(userId: string): Promise<string> {
  const admin = createAdminClient();

  await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("label", LABEL)
    .is("revoked_at", null);

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const keyPrefix = token.slice(0, 8);

  const { error } = await admin.from("api_keys").insert({
    user_id: userId,
    label: LABEL,
    key_prefix: keyPrefix,
    key_hash: hashToken(token),
    scopes: ["mcp"],
  });

  if (error) {
    throw new Error(error.message);
  }

  return token;
}

export async function revokeMcpToken(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("label", LABEL)
    .is("revoked_at", null);
}

/**
 * Resolves a raw MCP connector token (from the /api/mcp/[token] URL) to the
 * owning user. Runs with no Supabase session — this IS the auth mechanism —
 * so it always goes through the service-role client.
 */
export async function verifyMcpToken(token: string): Promise<{ userId: string } | null> {
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (!data) return null;

  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return { userId: data.user_id };
}
