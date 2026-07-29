import { NextResponse } from "next/server";
import { getClient } from "@/lib/server/oauth/clients";
import { issueAuthorizationCode } from "@/lib/server/oauth/codes";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const clientId = form.get("client_id")?.toString();
  const redirectUri = form.get("redirect_uri")?.toString();
  const codeChallenge = form.get("code_challenge")?.toString();
  const codeChallengeMethod = form.get("code_challenge_method")?.toString() ?? "S256";
  const state = form.get("state")?.toString();
  const scope = form.get("scope")?.toString();
  const decision = form.get("decision")?.toString();

  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Re-validated here (not just trusted from the consent page's hidden
  // fields) since this is a separate request the browser could tamper with
  // -- same open-redirect concern as the GET page.
  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const callback = new URL(redirectUri);
  if (state) callback.searchParams.set("state", state);

  // 303 (not the 307 NextResponse.redirect() defaults to) so the browser
  // switches to GET on the client's redirect_uri regardless of this request
  // having been a POST -- 307/308 preserve the method, which made Claude's
  // OAuth callback (GET-only) reject the redirect as "Method Not Allowed".
  if (decision !== "approve") {
    callback.searchParams.set("error", "access_denied");
    return NextResponse.redirect(callback.toString(), 303);
  }

  const code = await issueAuthorizationCode({
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
  });

  callback.searchParams.set("code", code);
  return NextResponse.redirect(callback.toString(), 303);
}
