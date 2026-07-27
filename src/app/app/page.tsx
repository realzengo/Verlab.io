import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import { Download, Image as ImageIcon, Sparkles, SquareDashed, SquarePlay, TrendingUp, Wand2, Zap } from "lucide-react";
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

function ImageGeneratorPreview() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card-sm border border-hairline bg-gradient-to-br from-accent to-primary/15 shadow-card">
        <ImageIcon className="h-6 w-6 text-primary" />
      </div>
      <div className="flex items-center gap-1.5 rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-medium text-heading">Generating thumbnail...</span>
      </div>
    </div>
  );
}

function DownloaderPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5 rounded-card-sm border border-hairline bg-surface p-3 text-left shadow-card">
      <div className="flex items-center gap-2">
        <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-medium text-heading">tiktok.com/@creator/video</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className="h-full w-2/3 rounded-full bg-primary" />
      </div>
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
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    href: "/app/image-generator",
    preview: <ImageGeneratorPreview />,
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos to your device without the watermark.",
    href: "/app/downloads",
    preview: <DownloaderPreview />,
  },
] satisfies {
  title: string;
  description: string;
  href: string;
  preview: React.ReactNode;
  beta?: boolean;
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
          <h1 className="bg-gradient-to-b from-heading to-heading/60 bg-clip-text text-xl font-semibold leading-[1.15] tracking-[-0.02em] text-transparent sm:text-2xl">
            Hello {displayName(user)}, what would you like to create today?
          </h1>
        </div>
        <div className="mb-8 grid grid-cols-3 gap-2 sm:mb-12 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-surface px-2 py-3 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:bg-gradient-to-br hover:from-primary hover:to-primary-hover hover:shadow-card-hover dark:border-white/5 dark:bg-white/[0.04] dark:shadow-none dark:hover:border-primary/40 dark:hover:bg-gradient-to-br dark:hover:from-primary dark:hover:to-primary-hover dark:hover:shadow-blue sm:flex-row sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary/15 text-primary transition-all duration-200 group-hover:bg-white/15 group-hover:text-white group-hover:ring-1 group-hover:ring-inset group-hover:ring-white/40 dark:bg-gradient-to-br dark:from-zinc-600 dark:to-zinc-900 dark:text-white dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),inset_0_-2px_2px_0_rgba(0,0,0,0.4),0_2px_6px_0_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/10 dark:group-hover:bg-white/10 dark:group-hover:ring-white/25 dark:group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] sm:h-10 sm:w-10 sm:rounded-xl">
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
            />
          ))}
        </div>
      </section>
    </div>
  );
}
