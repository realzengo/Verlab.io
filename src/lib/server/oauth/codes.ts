import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE_TTL_MS = 5 * 60 * 1000;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function issueAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
}): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const admin = createAdminClient();

  const { error } = await admin.from("mcp_oauth_authorization_codes").insert({
    code_hash: hash(code),
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    scope: input.scope ?? null,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });

  if (error) throw new Error(error.message);
  return code;
}

export class InvalidGrantError extends Error {
  constructor(message = "Invalid or expired authorization code") {
    super(message);
    this.name = "InvalidGrantError";
  }
}

/**
 * Validates and single-use-consumes an authorization code: redirect_uri must
 * match exactly what /authorize issued it for, and the PKCE code_verifier's
 * SHA-256 (base64url) must match the stored code_challenge. The UPDATE ...
 * WHERE used_at IS NULL ... RETURNING is one atomic statement, so a code
 * can never be consumed twice even under concurrent requests.
 */
export async function consumeAuthorizationCode(
  code: string,
  input: { redirectUri: string; codeVerifier: string }
): Promise<{ clientId: string; userId: string; scope: string | null }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("mcp_oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hash(code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new InvalidGrantError();

  if (data.redirect_uri !== input.redirectUri) {
    throw new InvalidGrantError("redirect_uri does not match the original authorization request");
  }

  if (data.code_challenge_method !== "S256") {
    throw new InvalidGrantError("Unsupported code_challenge_method");
  }

  const expectedChallenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
  if (expectedChallenge !== data.code_challenge) {
    throw new InvalidGrantError("code_verifier does not match code_challenge");
  }

  return { clientId: data.client_id, userId: data.user_id, scope: data.scope };
}
