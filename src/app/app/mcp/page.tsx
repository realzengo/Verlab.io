"use client";

import { useState } from "react";
import { Check, Copy, Play } from "lucide-react";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
import { LogoMark } from "@/components/ui/Logo";
import { McpConnectSection, MCP_URL } from "@/components/mcp/McpConnectSection";

const CONNECT_TABS = [
  { id: "claude", label: "For Claude", icon: ClaudeIcon },
  { id: "chatgpt", label: "For ChatGPT", icon: ChatGPTIcon },
];

const CONNECT_STEPS: Record<string, { title: string; description: string }[]> = {
  claude: [
    { title: "Copy MCP link", description: "" },
    {
      title: "Paste the link",
      description: 'In Claude, go to Settings > Connectors > Add custom connector, then paste the link.',
    },
    { title: "Restart & you're set", description: "Restart Claude Desktop to load the Verlab tools and start chatting." },
  ],
  chatgpt: [
    { title: "Copy MCP link", description: "" },
    {
      title: "Paste the link",
      description: 'In ChatGPT, go to Settings > Connected Apps > Add MCP Server, then paste the link.',
    },
    { title: "Log in and done", description: "Log in with your Verlab account and that's it!" },
  ],
};

export default function McpPage() {
  const [activeTab, setActiveTab] = useState("claude");
  const [copied, setCopied] = useState(false);

  const activeTabConfig = CONNECT_TABS.find((tab) => tab.id === activeTab) ?? CONNECT_TABS[0];
  const ActivePlatformIcon = activeTabConfig.icon;
  const platformLabel = activeTab === "claude" ? "Claude" : "ChatGPT";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`https://${MCP_URL}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full py-8">
      <McpConnectSection compact />

      <div className="mx-auto mt-14 max-w-5xl text-center sm:mt-20 lg:mt-28">
        <h2 className="text-2xl font-black tracking-[-1px] text-heading sm:text-[32px] lg:text-[36px]">
          How To Set Verlab MCP Up
        </h2>

        <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-hairline bg-surface p-1.5 sm:mt-6">
          {CONNECT_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
                  isActive ? "bg-primary/10 text-primary ring-1 ring-primary/40" : "text-subtle hover:text-body"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10 sm:h-4 sm:w-4" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-2xl border border-hairline bg-surface text-left shadow-card sm:mt-10 sm:rounded-[32px] lg:grid-cols-2">
          <div className="border-b border-hairline p-5 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <h3 className="text-lg font-bold text-heading sm:text-xl">How it works</h3>
            <p className="mt-2 text-sm leading-relaxed text-body">
              Ask about any creator or video, search trending niches, and generate scripts — all from inside your
              favorite AI chat.
            </p>

            <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-xl bg-black sm:mt-6 sm:rounded-2xl">
              <div
                aria-hidden
                className="absolute inset-0 [background-image:radial-gradient(circle_at_30%_15%,rgba(51,92,255,0.45),transparent_60%)]"
              />
              <div className="absolute left-4 top-4 flex items-center gap-1.5 sm:left-6 sm:top-6 sm:gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary sm:h-10 sm:w-10">
                  <LogoMark className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <span className="text-base font-bold text-white/60 sm:text-lg">+</span>
                <ActivePlatformIcon className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-white/15 sm:h-10 sm:w-10 sm:rounded-[10px]" />
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-sm sm:h-14 sm:w-14">
                  <Play className="h-4 w-4 translate-x-0.5 fill-white text-white sm:h-5 sm:w-5" />
                </span>
              </div>

              <p className="absolute inset-x-4 bottom-4 text-sm font-black leading-tight text-white sm:inset-x-5 sm:bottom-5 sm:text-lg lg:text-xl">
                How to Connect Verlab to {platformLabel} in 30 Seconds
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-8 lg:p-10">
            <ol className="flex flex-col gap-5 sm:gap-7">
              {CONNECT_STEPS[activeTab].map((step, i) => (
                <li key={step.title} className="flex gap-3 sm:gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 text-sm font-bold text-primary sm:h-9 sm:w-9">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h4 className="text-sm font-bold text-heading sm:text-base">{step.title}</h4>
                    {i === 0 ? (
                      <div className="mt-2 flex items-center gap-2 rounded-full border border-hairline bg-app py-1.5 pl-3 pr-1.5 sm:pl-4">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-body sm:text-sm">{MCP_URL}</span>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors sm:px-3.5 sm:py-2 dark:bg-white dark:text-black dark:hover:bg-slate-100 hover:bg-slate-800"
                        >
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-sm leading-relaxed text-body">{step.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-5xl text-center sm:mt-24 lg:mt-32">
        <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary sm:px-3.5">
          How it works
        </span>

        <h2 className="mt-4 text-2xl font-black tracking-[-1px] text-heading sm:text-[32px] lg:text-[38px]">
          Getting Started with Verlab MCP
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-body sm:mt-4 sm:text-base">
          Integrate Verlab into your AI workflow in under 60 seconds. Copy your unique MCP URL, connect it to your
          preferred LLM, and start extracting viral insights instantly.
        </p>

        <div className="relative isolate mt-8 overflow-hidden rounded-2xl border border-hairline bg-surface p-5 sm:mt-12 sm:rounded-[32px] sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,black,transparent)] dark:opacity-30 dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)]"
          />

          <div className="grid grid-cols-1 gap-8 text-left sm:gap-10 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-hairline">
            <div className="lg:px-8">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-subtle">Step 01</span>
              <h3 className="mt-1 text-base font-bold text-heading sm:text-lg">Copy Your MCP URL</h3>

              <div className="mt-4 flex min-h-[150px] items-center justify-center rounded-xl border border-hairline bg-app p-4 sm:mt-5 sm:min-h-[180px] sm:rounded-2xl sm:p-5">
                <div className="flex w-full max-w-[280px] items-center gap-2 rounded-full border border-hairline bg-surface py-1.5 pl-3 pr-1.5 sm:pl-4">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-body sm:text-sm">{MCP_URL}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors sm:px-3.5 sm:py-2 dark:bg-white dark:text-black dark:hover:bg-slate-100 hover:bg-slate-800"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-body sm:mt-4">
                Grab the unique MCP connector link from the top of this page — one click to copy.
              </p>
            </div>

            <div className="lg:px-8">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-subtle">Step 02</span>
              <h3 className="mt-1 text-base font-bold text-heading sm:text-lg">Connect to Your AI</h3>

              <div className="mt-4 flex min-h-[150px] items-center justify-center rounded-xl border border-hairline bg-app p-4 sm:mt-5 sm:min-h-[180px] sm:rounded-2xl sm:p-5">
                <div className="w-full max-w-[240px] rounded-xl border border-hairline bg-surface p-3.5 shadow-card">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                      <LogoMark className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-semibold text-heading">Verlab</span>
                  </div>
                  <div className="mt-2.5 truncate rounded-lg bg-app px-2.5 py-1.5 font-mono text-xs text-subtle">
                    {MCP_URL}
                  </div>
                  <span className="mt-2.5 block w-full rounded-full bg-primary py-2 text-center text-xs font-semibold text-white">
                    Connect
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-body sm:mt-4">
                Open Claude or ChatGPT, go to Settings → Connectors, and paste your link.
              </p>
            </div>

            <div className="lg:px-8">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-subtle">Step 03</span>
              <h3 className="mt-1 text-base font-bold text-heading sm:text-lg">Start Creating</h3>

              <div className="relative mt-4 min-h-[150px] overflow-hidden rounded-xl border border-hairline bg-app p-4 sm:mt-5 sm:min-h-[180px] sm:rounded-2xl sm:p-5">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-40">
                  <path d="M22 50 C 45 50, 55 25, 78 25" stroke="#335cff" strokeWidth="1" fill="none" />
                  <path d="M22 50 C 45 50, 55 75, 78 75" stroke="#335cff" strokeWidth="1" fill="none" />
                </svg>

                <span className="absolute left-[14%] top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white shadow-blue sm:h-11 sm:w-11">
                  <LogoMark className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <ClaudeIcon className="absolute right-[14%] top-[25%] h-8 w-8 -translate-y-1/2 rounded-lg ring-1 ring-black/10 sm:h-10 sm:w-10 sm:rounded-[10px]" />
                <ChatGPTIcon className="absolute right-[14%] top-[75%] h-8 w-8 -translate-y-1/2 rounded-lg ring-1 ring-black/10 sm:h-10 sm:w-10 sm:rounded-[10px]" />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-body sm:mt-4">
                Ask about any creator or video in chat and get transcripts, niches, and scripts instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
