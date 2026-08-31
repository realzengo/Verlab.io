import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Plug, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[110px]" />

      <Card className="relative w-full max-w-md" shadow>
        <div className="flex items-center justify-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
            <ClientIcon clientName={client.clientName} />
          </span>

          <span className="relative flex shrink-0 items-center">
            <span className="h-px w-5 bg-gradient-to-r from-transparent to-hairline" />
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-app">
              <ArrowRight className="h-3 w-3 text-subtle" />
            </span>
            <span className="h-px w-5 bg-gradient-to-l from-transparent to-hairline" />
          </span>

          <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
            <Image src="/logo-icon.png" alt="" fill className="object-cover" sizes="64px" />
          </span>
        </div>

        <h1 className="mt-6 text-center text-xl font-bold tracking-tight text-heading">
          {clientLabel} wants to access Verlab
        </h1>
        <p className="mt-1.5 text-center text-sm text-subtle">on behalf of your account</p>

        <div className="mt-6 rounded-2xl border border-hairline bg-app p-4">
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            This will allow {clientLabel} to
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            <li className="flex items-center gap-3 text-sm font-medium text-heading">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3 w-3 text-primary" strokeWidth={3} />
              </span>
              View your email address
            </li>
            <li className="flex items-center gap-3 text-sm font-medium text-heading">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3 w-3 text-primary" strokeWidth={3} />
              </span>
              Use your Verlab tools and credits on your behalf
            </li>
          </ul>
        </div>

        <p className="mt-5 flex items-start justify-center gap-1.5 text-center text-xs text-subtle">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-subtle" />
          <span>
            Make sure you trust {clientLabel} ({requestedHost}). You may be sharing sensitive data with this app.
          </span>
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
            variant="ghost"
            size="lg"
            bevel={false}
            className="flex-1 justify-center border border-hairline"
          >
            Deny
          </Button>
          <Button
            type="submit"
            name="decision"
            value="approve"
            variant="primary"
            size="lg"
            bevel={false}
            className="flex-1 justify-center"
          >
            Allow
          </Button>
        </form>
      </Card>
    </div>
  );
}
