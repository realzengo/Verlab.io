"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ClaudeIcon } from "@/components/landing/AssistantIcons";
import { VerlabClaudeChatDemo } from "@/components/mcp/VerlabClaudeChatDemo";
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
      className={cn("relative", compact ? "py-8 sm:py-12" : "pb-16 pt-20 sm:pb-24 sm:pt-32", className)}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-[9fr_11fr] lg:gap-16">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.06]">
            <ClaudeIcon className="h-4 w-4 rounded-[5px]" />
            <span className="text-xs font-semibold text-slate-900 sm:text-sm dark:text-white">Claude and ChatGPT</span>
          </div>

          <h1 className="mt-5 text-[34px] font-black leading-[1.1] tracking-[-1.5px] text-slate-900 sm:mt-6 sm:text-[46px] sm:leading-[1.06] lg:text-[52px] dark:text-white">
            Verlab now works
            <br />
            inside Claude and ChatGPT
          </h1>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 sm:mt-6 sm:text-base dark:text-slate-400">
            Connect Verlab to Claude over MCP and research niches, analyze creators, and generate scripts straight
            from your prompts. The whole toolkit, driven by chat.
          </p>

          <div className="mt-6 flex w-full max-w-md items-center gap-2 rounded-full border-2 border-black/10 bg-white p-1.5 pl-4 sm:mt-8 sm:pl-6 dark:border-white/15 dark:bg-black">
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
          <p className="mt-2 max-w-md text-xs text-slate-500 dark:text-slate-500">
            Same link for everyone. You&apos;ll log into Verlab and approve access when you connect.
          </p>
        </div>

        <VerlabClaudeChatDemo className="mx-auto w-full max-w-lg lg:max-w-none" />
      </div>
    </section>
  );
}
