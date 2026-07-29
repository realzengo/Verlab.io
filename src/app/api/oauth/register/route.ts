import { NextResponse } from "next/server";
import { registerClient } from "@/lib/server/oauth/clients";

interface RegisterRequestBody {
  client_name?: string;
  redirect_uris?: string[];
}

function isWellFormedUri(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// OAuth 2.0 Dynamic Client Registration (RFC 7591). Public client only (no
// client_secret) -- Claude/ChatGPT register themselves with no prior
// server-specific credential, and PKCE (see oauth/codes.ts) covers what a
// confidential client's secret would otherwise provide.
export async function POST(request: Request): Promise<NextResponse> {
  let body: RegisterRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every(isWellFormedUri)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris must be a non-empty array of absolute URIs" },
      { status: 400 }
    );
  }

  const client = await registerClient({
    clientName: typeof body.client_name === "string" ? body.client_name : undefined,
    redirectUris,
  });

  return NextResponse.json({
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
}
