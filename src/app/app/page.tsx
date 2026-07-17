import { CheckCircle2, Captions, PenSquare, Plug, TrendingUp, Wand2 } from "lucide-react";
import { ToolCard } from "@/components/dashboard/ToolCard";

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
      <p className="truncate font-mono text-[11px] text-heading">api.clypa.io/mcp/v1/sse</p>
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
    title: "Script Maker",
    description: "Generate ready-to-film scripts — hook, body, and CTA — from a bent SOP.",
    href: "/app/bend",
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
    description: "Connect Clypa to Claude or ChatGPT to bend niches and pull transcripts right from chat.",
    href: "/app/mcp",
    preview: <McpPreview />,
  },
  {
    title: "API Access",
    description: "Full REST API access to every Clypa tool for your own pipeline.",
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

export default function AppHome() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <section>
        <h2 className="font-heading text-4xl font-extrabold tracking-tight text-heading">Tools</h2>
        <p className="mt-2 text-base text-body">
          Powerful tools to bend niches, discover trends, and ship faceless content faster.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
