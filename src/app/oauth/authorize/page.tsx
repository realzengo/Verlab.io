import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle2, Plug } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
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

function ClientIcon({ clientName }: { clientName: string | null }) {
  const name = (clientName ?? "").toLowerCase();
  if (name.includes("claude")) return <ClaudeIcon className="h-full w-full" />;
  if (name.includes("chatgpt") || name.includes("gpt")) return <ChatGPTIcon className="h-full w-full" />;
  return (
    <span className="flex h-full w-full items-center justify-center bg-accent text-primary">
      <Plug className="h-6 w-6" />
    </span>
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
  const requestedHost = (() => {
    try {
      return new URL(redirect_uri).host;
    } catch {
      return redirect_uri;
    }
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
            <ClientIcon clientName={client.clientName} />
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-hairline" />
            <span className="h-1.5 w-1.5 rounded-full bg-hairline" />
            <span className="h-1.5 w-1.5 rounded-full bg-hairline" />
          </span>
          <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
            <Image src="/logo-icon.png" alt="" fill className="object-contain p-1.5" sizes="64px" />
          </span>
        </div>

        <h1 className="mt-6 text-center text-xl font-bold text-heading">{clientLabel} wants to access Verlab</h1>
        <p className="mt-1.5 text-center text-sm text-subtle">on behalf of your account</p>

        <div className="mt-6 rounded-2xl border border-hairline bg-app p-4">
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            This will allow {clientLabel} access to:
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            <li className="flex items-center gap-2.5 text-sm text-heading">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              Your email address
            </li>
            <li className="flex items-center gap-2.5 text-sm text-heading">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              Use your Verlab tools and credits on your behalf
            </li>
          </ul>
        </div>

        <p className="mt-5 text-center text-xs text-subtle">
          Make sure you trust {clientLabel} ({requestedHost}). You may be sharing sensitive data with this site or
          app.
        </p>

        <form method="POST" action="/api/oauth/authorize" className="mt-6 flex gap-3">
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="code_challenge" value={code_challenge} />
          <input type="hidden" name="code_challenge_method" value={code_challenge_method ?? "S256"} />
          {state && <input type="hidden" name="state" value={state} />}
          {scope && <input type="hidden" name="scope" value={scope} />}

          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="secondary"
            size="lg"
            className="flex-1 justify-center"
          >
            Deny
          </Button>
          <Button
            type="submit"
            name="decision"
            value="approve"
            variant="primary"
            size="lg"
            className="flex-1 justify-center"
          >
            Allow
          </Button>
        </form>
      </Card>
    </div>
  );
}
