"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, ExternalLink } from "lucide-react";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
import { MCP_PATH } from "@/components/mcp/McpConnectSection";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "claude", label: "Claude", icon: ClaudeIcon },
  { id: "chatgpt", label: "ChatGPT", icon: ChatGPTIcon },
];

export function McpSetupFlow() {
  const [activeTab, setActiveTab] = useState("claude");
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${MCP_PATH}` : `verlab.io${MCP_PATH}`;
  const platformLabel = activeTab === "chatgpt" ? "ChatGPT" : "Claude";
  const settingsHref = activeTab === "chatgpt" ? "https://chatgpt.com" : "https://claude.ai";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative w-full p-6 sm:p-10 lg:p-14">
      <div className="relative">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex -skew-x-12 items-center justify-center rounded-md bg-[radial-gradient(circle_at_35%_30%,#7ea6ff,#3d5fff_70%)] px-4 py-1.5">
            <span className="flex skew-x-12 items-center justify-center text-xs font-bold italic uppercase tracking-wide text-white">
              How it works
            </span>
          </span>
          <h2 className="mt-4 text-2xl font-black tracking-[-1px] text-heading sm:text-[32px] lg:text-[36px]">
            Connect once. Ask for anything.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-body sm:text-base">
            One connector URL links your whole Verlab account to your AI assistant. No keys, no setup per tool.
          </p>

          <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-hairline bg-app p-1">
            {TABS.map(({ id, label, icon: Icon }) => {
              const isActive = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(id)}
                  className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm"
                >
                  {isActive && (
                    <motion.span
                      layoutId="mcp-setup-tab-pill"
                      transition={{ type: "spring", stiffness: 500, damping: 34, mass: 0.9 }}
                      className="absolute inset-0 rounded-full bg-surface shadow-card"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex items-center gap-1.5",
                      isActive ? "text-heading" : "text-subtle hover:text-body"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10 sm:h-4 sm:w-4" />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative mt-12 grid grid-cols-1 gap-8 sm:mt-16 md:grid-cols-3">
          <div
            aria-hidden
            className="absolute inset-x-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent md:block"
          />

          <div className="premium-hover-border flex flex-col items-center rounded-2xl border border-hairline bg-app p-6 text-center transition-transform duration-300 hover:-translate-y-1 md:items-start md:text-left">
            <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-app bg-gradient-to-br from-[#5b82ff] to-primary text-base font-bold text-white shadow-blue">
              1
            </span>
            <h3 className="mt-4 text-base font-bold text-heading sm:text-lg">Copy the link</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              Every Verlab account gets one connector URL. Grab it below.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "mt-4 flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 py-2.5 text-left transition-all duration-300",
                copied ? "border-emerald-500/40" : "border-hairline hover:border-primary/40 hover:shadow-card"
              )}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-body sm:text-sm">{url}</span>
              {copied ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0 text-subtle" />
              )}
            </button>
          </div>

          <div className="premium-hover-border flex flex-col items-center rounded-2xl border border-hairline bg-app p-6 text-center transition-transform duration-300 hover:-translate-y-1 md:items-start md:text-left">
            <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-app bg-gradient-to-br from-[#5b82ff] to-primary text-base font-bold text-white shadow-blue">
              2
            </span>
            <h3 className="mt-4 text-base font-bold text-heading sm:text-lg">Add the connector</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              In {platformLabel}, go to Settings → Connectors, name it Verlab, and paste the link.
            </p>
            <div className="mt-4 w-full rounded-xl border border-hairline bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-[6px] ring-1 ring-black/10">
                  <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#5b82ff] to-primary text-[10px] font-bold text-white">
                    V
                  </span>
                </span>
                <span className="text-sm font-semibold text-heading">Verlab</span>
              </div>
              <div className="mt-2 truncate rounded-lg bg-app px-2.5 py-1.5 font-mono text-xs text-subtle">
                {url}
              </div>
            </div>
          </div>

          <div className="premium-hover-border flex flex-col items-center rounded-2xl border border-hairline bg-app p-6 text-center transition-transform duration-300 hover:-translate-y-1 md:items-start md:text-left">
            <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-app bg-gradient-to-br from-[#5b82ff] to-primary text-base font-bold text-white shadow-blue">
              3
            </span>
            <h3 className="mt-4 text-base font-bold text-heading sm:text-lg">Connect &amp; approve</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              You&apos;ll be sent to Verlab to log in and approve access. Then it&apos;s ready to use.
            </p>
            <a
              href={settingsHref}
              target="_blank"
              rel="noreferrer"
              className="group/link mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-surface px-3.5 py-2.5 transition-all duration-300 hover:border-primary/40 hover:shadow-card"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-heading">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Verlab connected
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-subtle transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5 group-hover/link:text-primary" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
