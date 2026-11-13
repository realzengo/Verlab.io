import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Mail, Plug, ShieldCheck, Unplug, Zap } from "lucide-react";
import { APP_TILE, BezelPanel } from "@/components/brand/BrandKit";
import { ClaudeIcon, ChatGPTMarkIcon } from "@/components/landing/AssistantIcons";
import { PlasticButton } from "@/components/ui/plastic-button";
import { cn } from "@/lib/utils";

// The OAuth consent screen an AI app (Claude, ChatGPT) sends people to when
// they connect Verlab. Built in the Verlab bezel language (BrandKit) to the
// unslop + Stageshow craft rules: plain ground, one sheet, the two app icons
// as the only color, hairline sections, one blue action. /oauth is an
// unthemed route (see app/layout.tsx), so this is light only.

/** The fields the consent form posts back to /api/oauth/authorize. */
export interface ConsentRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  scope?: string;
}

interface ConsentScreenProps {
  clientName: string | null;
  /** The redirect URI's host, e.g. "claude.ai". */
  requestedHost: string;
  /** The signed-in Verlab account the app will act as. */
  accountEmail: string | null;
  request: ConsentRequest;
}

// Both marks are full app icons with their own rounded corners, so they share
// one drop shadow that follows their alpha instead of sitting in a box.
const ICON_SHADOW = "[filter:drop-shadow(0_1px_1px_rgba(15,23,42,0.12))_drop-shadow(0_8px_16px_rgba(15,23,42,0.16))]";

function ClientMark({ clientName }: { clientName: string | null }) {
  const name = (clientName ?? "").toLowerCase();
  if (name.includes("claude")) return <ClaudeIcon aria-hidden="true" className={cn("h-16 w-16 shrink-0", ICON_SHADOW)} />;
  if (name.includes("chatgpt") || name.includes("gpt")) {
    return (
      <span className={cn(APP_TILE, "h-16 w-16 shrink-0 rounded-[15px] text-[#0B0D12]")}>
        <ChatGPTMarkIcon aria-hidden="true" className="h-8 w-8" />
      </span>
    );
  }
  return (
    <span className={cn(APP_TILE, "h-16 w-16 shrink-0 rounded-[15px] text-subtle")}>
      <Plug aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
    </span>
  );
}

/** A dashed link between the two icons with the direction of the request. */
function Connector() {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className="w-4 border-t border-dashed border-[#CDD0D6]" />
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E3E5E9] bg-white text-subtle shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <ArrowRight className="h-3 w-3" strokeWidth={2} />
      </span>
      <span className="w-4 border-t border-dashed border-[#CDD0D6]" />
    </span>
  );
}

function AccountChip({ email }: { email: string }) {
  return (
    <div className="mt-4 flex justify-center">
      <div className="inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-[#E6E8EC] bg-[#F7F8FA] pl-1 pr-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold uppercase text-heading shadow-[0_0_0_1px_#E3E5E9,0_1px_2px_rgba(15,23,42,0.06)]">
          {email.charAt(0)}
        </span>
        <span className="truncate text-[13px] font-medium text-body">{email}</span>
      </div>
    </div>
  );
}

function Permission({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E6E8EC] bg-[#F7F8FA] text-body">
        <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 pt-[7px]">
        <p className="text-sm font-medium leading-[22px] text-heading">{title}</p>
        {detail && <p className="mt-0.5 text-[13px] leading-5 text-subtle">{detail}</p>}
      </div>
    </li>
  );
}

export function ConsentScreen({ clientName, requestedHost, accountEmail, request }: ConsentScreenProps) {
  const client = clientName || "This app";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4 py-12">
      <BezelPanel
        className="w-full max-w-[440px]"
        foot={
          <p className="flex items-start gap-2.5 px-4 pb-2.5 pt-3.5 text-[13px] leading-5 text-subtle">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              Only allow apps you trust. {client} (<span className="font-mono text-xs text-body">{requestedHost}</span>) keeps access until you
              disconnect it in Settings.
            </span>
          </p>
        }
      >
        <div className="px-6 pb-7 pt-9 text-center sm:px-8">
          <div aria-hidden="true" className="flex items-center justify-center gap-3">
            <ClientMark clientName={clientName} />
            <Connector />
            <Image src="/logos/verlab-app-icon.png" alt="" width={64} height={64} priority className={cn("h-16 w-16 shrink-0", ICON_SHADOW)} />
          </div>
          <h1 className="mt-7 text-balance text-[22px] font-semibold leading-[30px] tracking-[-0.01em] text-heading">
            {client} wants to access your Verlab account
          </h1>
          {accountEmail && <AccountChip email={accountEmail} />}
        </div>

        <div className="border-t border-[#EEF0F2] px-6 py-6 sm:px-8">
          <p className="text-[13px] font-medium leading-5 text-subtle">{client} will be able to</p>
          <ul className="mt-4 flex flex-col gap-4">
            <Permission icon={Mail} title="View your email address" />
            <Permission icon={Zap} title="Use your Verlab tools and credits" detail="Scripts, voiceovers, images, videos and clips. Generating spends your credits." />
          </ul>
        </div>

        <form method="POST" action="/api/oauth/authorize" className="grid grid-cols-2 gap-3 border-t border-[#EEF0F2] px-6 pb-6 pt-5 sm:px-8">
          <input type="hidden" name="client_id" value={request.clientId} />
          <input type="hidden" name="redirect_uri" value={request.redirectUri} />
          <input type="hidden" name="code_challenge" value={request.codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={request.codeChallengeMethod} />
          {request.state && <input type="hidden" name="state" value={request.state} />}
          {request.scope && <input type="hidden" name="scope" value={request.scope} />}

          {/* A neutral key with the same 4px lip as the blue PlasticButton, so the pair sits level. */}
          <button
            type="submit"
            name="decision"
            value="deny"
            className="h-11 rounded-2xl border border-[#E3E5E9] bg-white text-sm font-bold text-heading shadow-[0_4px_0_0_#E3E5E9] transition-[transform,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#FAFAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-1 active:shadow-[0_0_0_0_#E3E5E9] active:duration-100"
          >
            Deny
          </button>
          <PlasticButton type="submit" name="decision" value="approve" text="Allow" className="h-11 w-full" />
        </form>
      </BezelPanel>
    </main>
  );
}

/** Same frame for a request that can't be shown (bad parameters, unknown app). */
export function ConsentError({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4 py-12">
      <BezelPanel className="w-full max-w-[400px]" innerClassName="px-8 pb-9 pt-10 text-center">
        <span className={cn(APP_TILE, "mx-auto h-12 w-12 rounded-[14px] text-subtle")}>
          <Unplug aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-lg font-semibold leading-7 text-heading">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-subtle">{message}</p>
      </BezelPanel>
    </main>
  );
}
