import { NextResponse } from "next/server";

// RFC 8414 Authorization Server Metadata -- lets Claude/ChatGPT discover our
// OAuth endpoints instead of needing them hardcoded on their side. Origin is
// derived from the incoming request (not hardcoded) so this resolves
// correctly in local dev too.
export async function GET(request: Request): Promise<NextResponse> {
  const { origin } = new URL(request.url);

  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    scopes_supported: ["mcp"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}
