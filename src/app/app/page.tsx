import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Captions, PenSquare, Plug, SquareDashed, SquarePlay, TrendingUp, Wand2, Zap } from "lucide-react";
import { ToolCard } from "@/components/dashboard/ToolCard";
import { createClient } from "@/lib/supabase/server";

function displayName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "there";
}

const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Quick Editor", href: "/app/bend", icon: Zap },
  { label: "Full Editor", href: "/app/bend", icon: SquareDashed },
  { label: "AI Videos", href: "/app/niches", icon: SquarePlay },
];

function BendPreview() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Source</span>
        <p className="text-xs font-semibold text-heading">Medical Malpractice</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Wand2 className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-card-sm border border-primary/30 bg-primary/10 px-3 py-2.5 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Your niche</span>
        <p className="text-xs font-semibold text-heading">Corporate Fraud</p>
      </div>
    </div>
  );
}

function NicheFinderPreview() {
  const rows = [
    { name: "Medical Malpractice", category: "True crime", score: 94 },
    { name: "Corporate Espionage", category: "Business", score: 88 },
  ];
  return (
    <div className="flex w-full max-w-[240px] flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center justify-between rounded-card-sm border border-hairline bg-surface px-3 py-2 text-left shadow-card"
        >
          <div>
            <p className="text-xs font-semibold text-heading">{row.name}</p>
            <p className="text-[10px] text-body">{row.category}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
            <TrendingUp className="h-3 w-3" />
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}

function SopPreview() {
  const rows = ["Hook formula", "Script structure", "Pacing rules"];
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5 rounded-card-sm border border-hairline bg-surface p-3 text-left shadow-card">
      {rows.map((row) => (
        <div key={row} className="flex items-center gap-2 text-xs text-heading">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
          {row}
        </div>
      ))}
    </div>
  );
}

function TranscriptPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5 text-left">
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:04</span>
        <span className="line-clamp-1">The $2.3M mistake surgeons hope you never learn about...</span>
      </div>
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:09</span>
        <span className="line-clamp-1">Here&rsquo;s what actually happened...</span>
      </div>
    </div>
  );
}

function ScriptPreview() {
  const beats = [
    { label: "Hook", tone: "text-primary" },
    { label: "Body", tone: "text-heading" },
    { label: "CTA", tone: "text-heading" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {beats.map((beat, i) => (
        <div key={beat.label} className="flex items-center gap-1.5">
          <div className="rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-center shadow-card">
            <span className={`text-[11px] font-semibold ${beat.tone}`}>{beat.label}</span>
          </div>
          {i < beats.length - 1 && <div className="h-px w-3 bg-hairline" />}
        </div>
      ))}
    </div>
  );
}

function LibraryPreview() {
  const items = [
    { icon: Wand2, label: "Bend SOP" },
    { icon: Captions, label: "Transcript" },
    { icon: PenSquare, label: "Script" },
  ];
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-card-sm border border-hairline bg-surface px-3 py-2 text-left shadow-card"
        >
          <item.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-medium text-heading">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function McpPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-2 rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
      <div className="flex items-center gap-2">
        <Plug className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Connected</span>
      </div>
      <p className="truncate font-mono text-[11px] text-heading">api.verlab.io/mcp/v1/sse</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-primary">Claude</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-primary">ChatGPT</span>
      </div>
    </div>
  );
}

function ApiPreview() {
  return (
    <div className="w-full max-w-[220px] rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left font-mono text-[10.5px] shadow-card">
      <p className="text-primary">POST /v1/bend</p>
      <p className="mt-1 truncate text-body">Authorization: Bearer sk_live_•••</p>
      <p className="mt-1 text-success">200 OK</p>
    </div>
  );
}

const TOOLS = [
  {
    title: "Niche Bender",
    description: "Turn any viral niche into your own — steal the winning structure, swap the topic.",
    href: "/app/bend",
    preview: <BendPreview />,
  },
  {
    title: "Niche Finder",
    description: "Discover trending faceless niches on TikTok, ranked by momentum score.",
    href: "/app/niches",
    preview: <NicheFinderPreview />,
  },
  {
    title: "SOP Builder",
    description: "Reverse-engineer any niche's hook, structure, and pacing into a repeatable SOP.",
    href: "/app/bend",
    preview: <SopPreview />,
    beta: true,
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video instantly.",
    href: "/app/transcripts",
    preview: <TranscriptPreview />,
  },
  {
    title: "Scriptwriter",
    description: "Create engaging scripts for your videos with AI-powered writing assistance.",
    href: "/app/scripts",
    preview: <ScriptPreview />,
    beta: true,
  },
  {
    title: "Library",
    description: "Every transcript, SOP, and script saved and searchable in one place.",
    href: "/app/library",
    preview: <LibraryPreview />,
  },
  {
    title: "MCP",
    description: "Connect Verlab to Claude or ChatGPT to bend niches and pull transcripts right from chat.",
    href: "/app/mcp",
    preview: <McpPreview />,
  },
  {
    title: "API Access",
    description: "Full REST API access to every Verlab tool for your own pipeline.",
    href: "/app/settings/api",
    preview: <ApiPreview />,
    beta: true,
    cta: "Get API key",
  },
] satisfies {
  title: string;
  description: string;
  href: string;
  preview: React.ReactNode;
  beta?: boolean;
  cta?: string;
}[];

export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-4 pt-8 sm:pt-12">
      <section>
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-heading sm:text-2xl">Hello {displayName(user)}, what would you like to create today?</h1>
        </div>
        <div className="mb-8 grid grid-cols-3 gap-2 sm:mb-12 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-surface px-2 py-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-gradient-to-br hover:from-primary hover:to-primary-hover hover:shadow-card-hover dark:border-white/5 dark:bg-white/[0.04] dark:shadow-none dark:hover:border-transparent dark:hover:bg-none dark:hover:bg-btn-primary dark:hover:shadow-none sm:flex-row sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary/15 text-primary transition-colors group-hover:bg-white/15 group-hover:text-white group-hover:ring-1 group-hover:ring-inset group-hover:ring-white/40 dark:bg-gradient-to-br dark:from-zinc-600 dark:to-zinc-900 dark:text-white dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),inset_0_-2px_2px_0_rgba(0,0,0,0.4),0_2px_6px_0_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/10 dark:group-hover:bg-transparent dark:group-hover:ring-white/10 sm:h-10 sm:w-10 sm:rounded-xl">
                <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="text-center text-[11px] font-semibold text-heading transition-colors group-hover:text-white sm:text-sm">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.title}
              title={tool.title}
              description={tool.description}
              href={tool.href}
              previewSlot={tool.preview}
              beta={tool.beta}
              cta={tool.cta}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
