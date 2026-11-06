"use client";

import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUp, ArrowUpRight, Check, Copy } from "lucide-react";
import { ChatGPTMarkIcon, ClaudeMarkIcon } from "@/components/landing/AssistantIcons";
import { APP_TILE, TileSpecular, VerlabTile } from "@/components/brand/BrandKit";
import { MCP_PATH } from "@/components/mcp/McpConnectSection";
import { cn } from "@/lib/utils";

const MCP_URL_FALLBACK = `https://verlab.io${MCP_PATH}`;

type AssistantId = "claude" | "chatgpt";

const ASSISTANTS: Record<
  AssistantId,
  { label: string; connectorsHref: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  claude: { label: "Claude", connectorsHref: "https://claude.ai/settings/connectors", icon: ClaudeMarkIcon },
  chatgpt: { label: "ChatGPT", connectorsHref: "https://chatgpt.com/#settings/Connectors", icon: ChatGPTMarkIcon },
};

// ---------------------------------------------------------------------------
// Hero: a fanned deck of AI tiles around the Verlab mark
// ---------------------------------------------------------------------------

type FanLogo = { key: string; render: () => ReactNode };

const LOGO = "h-10 w-10 object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.12)]";

// eslint-disable-next-line @next/next/no-img-element -- static /public asset, no resize needed
const img = (src: string, className?: string) => <img src={src} alt="" className={cn(LOGO, className)} />;

// Outer → inner on each side. The assistants sit next to the center (they
// are what you connect), the generation models fan out behind them.
const LEFT_LOGOS: FanLogo[] = [
  { key: "gemini", render: () => img("/logos/ai/gemini.svg") },
  { key: "seedance", render: () => img("/logos/ai/seedance.webp") },
  { key: "chatgpt", render: () => <ChatGPTMarkIcon className={cn(LOGO, "text-heading")} /> },
];
const RIGHT_LOGOS: FanLogo[] = [
  { key: "claude", render: () => <ClaudeMarkIcon className={LOGO} /> },
  { key: "kling", render: () => img("/logos/ai/kling.svg") },
  { key: "grok", render: () => img("/logos/ai/grok.svg", "dark:invert") },
];

// Per distance from the center: horizontal offset, drop, tilt and scale.
// A tight, nearly flat row -- each tile tucks about a quarter under the next
// one in, and only the tilt grows toward the ends -- rather than a deep arc.
const FAN_STEPS = [
  { x: 90, y: 0, rotate: 5, scale: 1 },
  { x: 158, y: 2, rotate: 10, scale: 0.97 },
  { x: 214, y: 10, rotate: 16, scale: 0.9 },
];

// Static by design -- the deck renders in place, no entrance or idle motion.
function IconFan() {
  const tiles = [
    ...LEFT_LOGOS.map((logo, i) => ({ logo, step: LEFT_LOGOS.length - i, side: -1 })),
    ...RIGHT_LOGOS.map((logo, i) => ({ logo, step: i + 1, side: 1 })),
  ];

  return (
    // overflow-x-clip: the fixed-width deck is wider than a phone; clip it
    // sideways without cutting off the tiles' shadows below.
    <div aria-hidden className="relative h-[92px] w-full overflow-x-clip sm:h-[136px]">
      {/* Scaled as one piece so the arc keeps its proportions on phones. */}
      <div className="absolute left-1/2 top-0 h-[136px] w-[560px] -translate-x-1/2 origin-top scale-[0.68] sm:scale-100">
        {tiles.map(({ logo, step, side }) => {
          const { x, y, rotate, scale } = FAN_STEPS[step - 1];
          return (
            <div
              key={logo.key}
              className="absolute left-1/2 top-3 -ml-11"
              style={{
                zIndex: 30 - step * 10,
                transform: `translate(${side * x}px, ${y}px) rotate(${side * rotate}deg) scale(${scale})`,
              }}
            >
              <div className={APP_TILE}>
                <TileSpecular />
                <span className="relative">{logo.render()}</span>
              </div>
            </div>
          );
        })}

        <VerlabTile className="absolute left-1/2 top-0 z-40 -ml-14" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup panel
// ---------------------------------------------------------------------------

function StepColumn({
  number,
  title,
  children,
  action,
}: {
  number: string;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col py-8 first:pt-0 last:pb-0 lg:px-9 lg:py-0 lg:first:pl-0 lg:last:pr-0">
      <span className="inline-flex h-7 w-fit items-center rounded-md border border-hairline px-2 font-mono text-[11px] font-medium tracking-wider text-subtle">
        {number}
      </span>
      <h3 className="mt-6 text-[17px] font-semibold tracking-[-0.015em] text-heading">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-subtle">{children}</p>
      <div className="mt-6 lg:mt-auto lg:pt-8">{action}</div>
    </div>
  );
}

export function McpConnectPage() {
  const [assistantId, setAssistantId] = useState<AssistantId>("claude");
  const [copied, setCopied] = useState(false);
  // Starts as the generic fallback (matching SSR, since there's no window on
  // the server) and swaps to the real origin right after mount.
  const [url, setUrl] = useState(MCP_URL_FALLBACK);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from window.location, not a derived/external sync
    setUrl(`${window.location.origin}${MCP_PATH}`);
  }, []);

  const assistant = ASSISTANTS[assistantId];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied -- the link stays visible to copy by hand.
    }
  };

  return (
    <div className="w-full pb-4">
      {/* Hero */}
      <section className="flex flex-col items-center pt-10 text-center sm:pt-16">
        <IconFan />
        <h1 className="mt-8 bg-gradient-to-b from-[#0B0D12] to-[#0B0D12]/60 bg-clip-text pb-1 text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-transparent sm:mt-10 sm:text-[64px] lg:text-[72px] dark:from-white dark:to-white/55">
          Verlab MCP
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-subtle sm:text-[17px]">
          Ask Claude or ChatGPT for a script, an image, a video or a voiceover. Verlab makes it right inside your chat.
        </p>
      </section>

      {/* Setup -- a double-bezel panel: a tinted shell around a crisp inner card */}
      <section className="mx-auto mt-14 w-full max-w-6xl sm:mt-20">
        <div className="rounded-[30px] border border-[#EBEDF0] bg-[#F5F6F8] p-1.5 dark:border-white/[0.06] dark:bg-white/[0.025]">
          <div className="overflow-hidden rounded-[24px] border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-32px_rgba(16,24,40,0.18)] dark:border-white/[0.07] dark:bg-[#0E0E10] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-8">
              <div role="tablist" aria-label="Choose your assistant" className="inline-flex items-center gap-0.5 rounded-full bg-(--app-fill) p-1">
                {(Object.keys(ASSISTANTS) as AssistantId[]).map((id) => {
                  const { label, icon: Icon } = ASSISTANTS[id];
                  const isActive = id === assistantId;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setAssistantId(id)}
                      className="relative inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium"
                    >
                      {isActive && (
                        <motion.span
                          layoutId="mcp-connect-tab"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-[#232326] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_0_1px_rgba(255,255,255,0.06)]"
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 flex items-center gap-2 transition-colors",
                          isActive ? "text-heading" : "text-subtle hover:text-heading"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="hidden font-mono text-[11px] uppercase tracking-wider text-subtle sm:block">
                Setup takes about a minute
              </span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-hairline p-5 sm:p-8 lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:py-10">
              <StepColumn
                number="01"
                title="Grab your server link"
                action={
                  <div className="flex items-center gap-2 rounded-xl border border-hairline bg-(--app-fill) p-1.5 pl-3.5">
                    {/* Scheme dropped for display so the path stays visible; Copy still
                        copies the full https:// URL. */}
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-heading">
                      {url.replace(/^https?:\/\//, "")}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-white px-2.5 text-xs font-medium text-heading shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:bg-[#F7F8FA] dark:bg-[#1C1C1F] dark:hover:bg-[#232326]"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-subtle" />}
                      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                }
              >
                This is Verlab&apos;s MCP address. Copy it and keep it handy for the next step.
              </StepColumn>

              <StepColumn
                number="02"
                title={`Add it to ${assistant.label}`}
                action={
                  <a
                    href={assistant.connectorsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex h-11 items-center gap-2 rounded-full bg-[#0B0D12] pl-5 pr-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(15,23,42,0.2),0_8px_20px_-10px_rgba(15,23,42,0.5)] transition-colors hover:bg-[#1A1D24] dark:bg-white dark:text-[#0B0D12] dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] dark:hover:bg-[#E9EAEE]"
                  >
                    Open {assistant.label} connectors
                    <ArrowUpRight className="h-4 w-4 opacity-60 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                }
              >
                In {assistant.label}&apos;s connector settings, add a new connector called{" "}
                <span className="font-medium text-heading">Verlab</span> and paste the link in.
              </StepColumn>

              <StepColumn
                number="03"
                title="Approve and start creating"
                action={
                  // A quiet preview of the first prompt, styled as a chat composer.
                  <div className="flex items-center gap-3 rounded-xl border border-hairline bg-white p-1.5 pl-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-[#141416]">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-subtle">
                      Script a 30s TikTok about cold plunges
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B0D12] text-white dark:bg-white dark:text-[#0B0D12]">
                      <ArrowUp className="h-4 w-4" />
                    </span>
                  </div>
                }
              >
                Sign in with your Verlab account when {assistant.label} asks to connect. Your first video is{" "}
                <span className="font-medium text-heading">one prompt away</span>.
              </StepColumn>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-subtle">
          Already connected?{" "}
          <Link href="/settings/mcp" className="font-medium text-heading underline-offset-4 hover:underline">
            Manage access in Settings
          </Link>
        </p>
      </section>
    </div>
  );
}
