"use client";

import { useState } from "react";
import { Check, Copy, Play } from "lucide-react";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
import { cn } from "@/lib/utils";

export const MCP_PATH = "/api/mcp";

export function McpConnectSection({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${MCP_PATH}` : `verlab.io${MCP_PATH}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className={cn(
        "relative",
        compact ? "py-12 sm:py-16 lg:py-20" : "pb-16 pt-20 sm:pb-24 sm:pt-32 lg:pb-32 lg:pt-40",
        className
      )}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 sm:gap-12 lg:grid-cols-[11fr_9fr] lg:gap-16">
        <div className="mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 dark:border-white/10 dark:bg-white/[0.06]">
            <span className="flex items-center gap-1.5">
              <ClaudeIcon className="h-4 w-4 rounded-[5px] sm:h-5 sm:w-5 sm:rounded-[6px]" />
              <ChatGPTIcon className="h-4 w-4 rounded-[5px] sm:h-5 sm:w-5 sm:rounded-[6px]" />
            </span>
            <span className="text-xs font-semibold text-slate-900 sm:text-sm dark:text-white">
              Available on Claude &amp; ChatGPT
            </span>
          </div>

          <h1 className="mt-5 text-[28px] font-black leading-[1.12] tracking-[-1px] text-slate-900 sm:mt-6 sm:text-[36px] sm:leading-[1.08] sm:tracking-[-1.5px] lg:text-[46px] lg:leading-[1.06] dark:text-white">
            Verlab now works
            <br />
            inside Claude and ChatGPT
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600 sm:mt-6 sm:text-base dark:text-slate-400">
            Ask anything about any creator or video. Add TikTok, Instagram, and YouTube directly into Claude &amp;
            ChatGPT. Get real insights, ask, plan, create directly in chat.
          </p>

          <div className="mx-auto mt-6 flex w-full max-w-md items-center gap-2 rounded-full border-2 border-black/10 bg-white p-1.5 pl-4 sm:mt-8 sm:pl-6 dark:border-white/15 dark:bg-black">
            <span className="min-w-0 flex-1 truncate text-left font-mono text-sm text-slate-700 sm:text-base dark:text-slate-200">
              {url}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors sm:gap-2 sm:px-5 sm:py-3 sm:text-sm dark:bg-white dark:text-black dark:hover:bg-slate-100 hover:bg-slate-800"
            >
              {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500 dark:text-slate-500">
            Same link for everyone — you&apos;ll log into Verlab and approve access when you connect.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:max-w-lg">
          <div aria-hidden className="absolute -inset-6 -z-10 rounded-[40px] bg-blue-500/20 blur-[60px] sm:-inset-8 sm:blur-[70px] dark:bg-blue-500/30" />
          <div className="rounded-[22px] bg-gradient-to-b from-blue-400/80 to-blue-600/80 p-[2px] shadow-[0_0_50px_rgba(59,130,246,0.35)] sm:rounded-[28px] dark:shadow-[0_0_50px_rgba(59,130,246,0.55)]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-black sm:rounded-[26px]">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-sm sm:h-16 sm:w-16">
                  <Play className="h-5 w-5 translate-x-0.5 fill-white text-white sm:h-6 sm:w-6" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
