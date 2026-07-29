"use client";

import { useState } from "react";
import { Check, Copy, Play } from "lucide-react";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
import { cn } from "@/lib/utils";

export interface McpConnectSectionProps {
  className?: string;
  compact?: boolean;
  /** Fixed, same for every user — safe to show and copy at any time. */
  connectorUrl: string | null;
  /** The raw API key secret — only populated right after (re)generating. */
  apiKey: string | null;
  /** Whether an active (but not currently visible) key already exists from a prior visit. */
  hasStoredToken: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

function CopyField({
  value,
  placeholder,
  action,
}: {
  value: string | null;
  placeholder: string;
  action: { label: string; onClick: () => void; disabled?: boolean } | { copy: string };
}) {
  const [copied, setCopied] = useState(false);

  const isCopyAction = "copy" in action;

  const handleClick = async () => {
    if (isCopyAction) {
      await navigator.clipboard.writeText(action.copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      action.onClick();
    }
  };

  return (
    <div className="mx-auto mt-3 flex w-full max-w-md items-center gap-2 rounded-full border-2 border-black/10 bg-white p-1.5 pl-4 dark:border-white/15 dark:bg-black">
      <span className="min-w-0 flex-1 truncate text-left font-mono text-sm text-slate-700 dark:text-slate-200">
        {value ?? placeholder}
      </span>
      <button
        type="button"
        onClick={handleClick}
        disabled={!isCopyAction && action.disabled}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 sm:gap-2 sm:px-5 sm:py-3 sm:text-sm dark:bg-white dark:text-black dark:hover:bg-slate-100 hover:bg-slate-800"
      >
        {isCopyAction ? (
          <>
            {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            {copied ? "Copied" : "Copy"}
          </>
        ) : (
          action.label
        )}
      </button>
    </div>
  );
}

export function McpConnectSection({
  className,
  compact = false,
  connectorUrl,
  apiKey,
  hasStoredToken,
  isLoading,
  isGenerating,
  onGenerate,
}: McpConnectSectionProps) {
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

          <p className="mx-auto mt-6 max-w-md text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:mt-8 dark:text-slate-500">
            1. Connector URL
          </p>
          <CopyField
            value={isLoading ? null : connectorUrl}
            placeholder="Loading…"
            action={{ copy: connectorUrl ?? "" }}
          />

          <p className="mx-auto mt-5 max-w-md text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
            2. API key (for the Authorization header)
          </p>
          <CopyField
            value={isLoading ? null : apiKey}
            placeholder={hasStoredToken ? "Regenerate to view your key" : "Generate a key below"}
            action={
              apiKey
                ? { copy: apiKey }
                : {
                    label: isGenerating ? "Generating…" : hasStoredToken ? "Regenerate" : "Generate key",
                    onClick: onGenerate,
                    disabled: isLoading || isGenerating,
                  }
            }
          />
          {apiKey && (
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-500 dark:text-slate-500">
              Save this key now — for your security we can&apos;t show it again. Lost it? Regenerate below.
            </p>
          )}
          {!apiKey && hasStoredToken && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={isLoading || isGenerating}
              className="mx-auto mt-2 block text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Regenerate API key"}
            </button>
          )}
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
