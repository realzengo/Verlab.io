import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsentError, ConsentScreen } from "@/components/oauth/ConsentScreen";
import { getClient } from "@/lib/server/oauth/clients";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface AuthorizeSearchParams {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<AuthorizeSearchParams>;
}) {
  const params = await searchParams;
  const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope } = params;

  if (response_type !== "code" || !client_id || !redirect_uri || !code_challenge) {
    return <ConsentError title="Invalid request" message="This connection request is missing required parameters." />;
  }

  if (code_challenge_method && code_challenge_method !== "S256") {
    return <ConsentError title="Unsupported request" message="Only the S256 PKCE method is supported." />;
  }

  const client = await getClient(client_id);
  if (!client || !client.redirectUris.includes(redirect_uri)) {
    // Never redirect back to an unregistered/mismatched redirect_uri --
    // that's the classic OAuth open-redirect footgun. Render an error here
    // instead of bouncing the user anywhere.
    return <ConsentError title="Unknown connector" message="This app isn't registered with Verlab, or its redirect URL doesn't match." />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const requestedHost = (() => {
    try {
      return new URL(redirect_uri).host;
    } catch {
      return redirect_uri;
    }
  })();

  return (
    <ConsentScreen
      clientName={client.clientName}
      requestedHost={requestedHost}
      accountEmail={user.email ?? null}
      request={{
        clientId: client_id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method ?? "S256",
        state,
        scope,
      }}
    />
  );
}
