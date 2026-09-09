"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
import { VerlabClaudeChatDemo } from "@/components/mcp/VerlabClaudeChatDemo";
import { McpSetupFlow } from "@/components/mcp/McpSetupFlow";
import { MCP_PATH } from "@/components/mcp/McpConnectSection";

const MCP_URL_FALLBACK = `verlab.io${MCP_PATH}`;

export function McpHero() {
  const [copied, setCopied] = useState(false);
  // Starts as the generic fallback (matching SSR, since there's no window on
  // the server) and swaps to the real origin right after mount.
  const [url, setUrl] = useState(MCP_URL_FALLBACK);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from window.location, not a derived/external sync
    setUrl(`${window.location.origin}${MCP_PATH}`);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative w-full overflow-hidden bg-white pb-16 pt-40 sm:pb-24 sm:pt-60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(51,92,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(51,92,255,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(60% 60% at 50% 0%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(60% 60% at 50% 0%, black 30%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-10">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-3.5 py-1.5 shadow-card">
            <span className="flex items-center -space-x-1.5">
              <ClaudeIcon className="h-4 w-4 rounded-[5px] ring-2 ring-white" />
              <ChatGPTIcon className="h-4 w-4 rounded-[5px] ring-2 ring-white" />
            </span>
            <span className="text-xs font-semibold text-heading sm:text-sm">Available on Claude &amp; ChatGPT</span>
          </div>

          <h1 className="mt-6 font-display text-[36px] font-black leading-[1.12] tracking-[-1px] text-heading sm:text-[46px] sm:leading-[1.08] sm:tracking-[-1.5px] lg:text-[52px]">
            Verlab now works
            <br />
            inside Claude and ChatGPT
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-body sm:text-lg">
            Ask anything about any creator or video. Pull niche research, creator breakdowns, and scripts straight into Claude &amp; ChatGPT — get real insights, plan, and create directly in chat.
          </p>

          <div className="mt-7 flex w-full max-w-md items-center gap-2 rounded-full border border-hairline bg-white p-1.5 pl-5 shadow-card">
            <span className="min-w-0 flex-1 truncate text-left font-mono text-sm text-body">{url}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-btn-primary px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-btn-primary-hover active:scale-[0.97] sm:text-sm"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 rounded-[48px] blur-3xl"
            style={{ background: "radial-gradient(closest-side, rgba(100,116,139,0.14), transparent 72%)" }}
          />
          <div
            className="rounded-[29px] p-px shadow-[0_30px_70px_-24px_rgba(15,23,42,0.35)]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #d3d8e2 0%, #f4f5f8 22%, #eef0f4 45%, #c7cddb 58%, #f7f8fa 78%, #d6dae4 100%)",
            }}
          >
            <VerlabClaudeChatDemo className="w-full" />
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-20 max-w-7xl px-4 sm:mt-28 sm:px-6">
        <McpSetupFlow />
      </div>
    </section>
  );
}
