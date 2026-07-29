import { NextResponse } from "next/server";
import { consumeAuthorizationCode, InvalidGrantError } from "@/lib/server/oauth/codes";
import { issueTokenPair, rotateRefreshToken, type TokenPair } from "@/lib/server/oauth/tokens";

function tokenResponse(pair: TokenPair): NextResponse {
  return NextResponse.json({
    access_token: pair.accessToken,
    token_type: "Bearer",
    expires_in: pair.expiresIn,
    refresh_token: pair.refreshToken,
    ...(pair.scope ? { scope: pair.scope } : {}),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const grantType = form.get("grant_type")?.toString();

  try {
    if (grantType === "authorization_code") {
      const code = form.get("code")?.toString();
      const redirectUri = form.get("redirect_uri")?.toString();
      const codeVerifier = form.get("code_verifier")?.toString();

      if (!code || !redirectUri || !codeVerifier) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      }

      const { clientId, userId, scope } = await consumeAuthorizationCode(code, { redirectUri, codeVerifier });
      const pair = await issueTokenPair({ clientId, userId, scope });
      return tokenResponse(pair);
    }

    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token")?.toString();
      if (!refreshToken) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      }

      const pair = await rotateRefreshToken(refreshToken);
      return tokenResponse(pair);
    }

    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      return NextResponse.json({ error: "invalid_grant", error_description: error.message }, { status: 400 });
    }
    throw error;
  }
}
