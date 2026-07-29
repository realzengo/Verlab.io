import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { getClient } from "@/lib/server/oauth/clients";
import { createClient } from "@/lib/supabase/server";

interface AuthorizeSearchParams {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <Card className="max-w-md text-center">
        <h1 className="text-lg font-bold text-heading">{title}</h1>
        <p className="mt-2 text-sm text-body">{message}</p>
      </Card>
    </div>
  );
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<AuthorizeSearchParams>;
}) {
  const params = await searchParams;
  const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope } = params;

  if (response_type !== "code" || !client_id || !redirect_uri || !code_challenge) {
    return <ErrorCard title="Invalid request" message="This connection request is missing required parameters." />;
  }

  if (code_challenge_method && code_challenge_method !== "S256") {
    return <ErrorCard title="Unsupported request" message="Only the S256 PKCE method is supported." />;
  }

  const client = await getClient(client_id);
  if (!client || !client.redirectUris.includes(redirect_uri)) {
    // Never redirect back to an unregistered/mismatched redirect_uri --
    // that's the classic OAuth open-redirect footgun. Render an error here
    // instead of bouncing the user anywhere.
    return <ErrorCard title="Unknown connector" message="This app isn't registered with Verlab, or its redirect URL doesn't match." />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const clientLabel = client.clientName || "This app";

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
            <LogoMark className="h-5 w-5" />
          </span>
        </div>

        <h1 className="mt-4 text-center text-lg font-bold text-heading">
          {clientLabel} wants to connect to your Verlab account
        </h1>
        <p className="mt-2 text-center text-sm text-body">
          Signed in as <span className="font-medium text-heading">{user!.email}</span>. This will let {clientLabel}{" "}
          use your Verlab tools and credits on your behalf.
        </p>

        <form method="POST" action="/api/oauth/authorize" className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="code_challenge" value={code_challenge} />
          <input type="hidden" name="code_challenge_method" value={code_challenge_method ?? "S256"} />
          {state && <input type="hidden" name="state" value={state} />}
          {scope && <input type="hidden" name="scope" value={scope} />}

          <Button type="submit" name="decision" value="approve" variant="primary" size="lg" className="justify-center">
            Approve
          </Button>
          <Button type="submit" name="decision" value="deny" variant="secondary" size="lg" className="justify-center">
            Deny
          </Button>
        </form>
      </Card>
    </div>
  );
}
