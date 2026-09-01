import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Captions,
  ChevronRight,
  Clapperboard,
  Compass,
  Download,
  Image as ImageIcon,
  Mic2,
  PenLine,
  Plug,
  Wand2,
} from "lucide-react";

const TOOLS: { title: string; description: string; href: string; icon: LucideIcon }[] = [
  {
    title: "Niche Bender",
    description: "Reverse-engineer a winning format and bend it into a fresh, non-competing niche.",
    href: "/bend",
    icon: Wand2,
  },
  {
    title: "Video Generator",
    description: "Create, edit, and animate watermark-free AI videos from a prompt or image.",
    href: "/video-generator",
    icon: Clapperboard,
  },
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images with AI.",
    href: "/image-generator",
    icon: ImageIcon,
  },
  {
    title: "Scriptwriter",
    description: "Write engaging video scripts with AI-powered writing assistance.",
    href: "/scripts",
    icon: PenLine,
  },
  {
    title: "Voiceover",
    description: "Turn scripts into natural-sounding AI voiceovers in seconds.",
    href: "/voiceover-generator",
    icon: Mic2,
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video.",
    href: "/transcripts",
    icon: Captions,
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos without the watermark.",
    href: "/downloads",
    icon: Download,
  },
  {
    title: "Niche Finder",
    description: "Explore trending TikTok niches and creators with real performance data.",
    href: "/niches",
    icon: Compass,
  },
  {
    title: "MCP",
    description: "Connect Verlab to Claude or ChatGPT and create from inside your AI chat.",
    href: "/mcp",
    icon: Plug,
  },
];

export function ToolsGrid() {
  const featured = TOOLS.slice(0, 5);

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">Browse our tools</h2>
          <p className="mt-1 text-sm text-subtle">A step-by-step guide to using our tools</p>
        </div>
        <Link
          href="/app/tools"
          className="mb-1 flex shrink-0 items-center gap-0.5 text-sm font-bold text-heading transition-colors hover:text-primary"
        >
          View all tools
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {featured.map((tool) => (
          <div
            key={tool.title}
            className="group flex flex-col rounded-2xl border border-hairline bg-surface p-5"
          >
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[22%] bg-gradient-to-b from-[#6EA8FF] to-[#2258E8] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),inset_0_-8px_12px_-2px_rgba(10,30,120,0.45)]">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1/2 rounded-t-[22%] bg-gradient-to-b from-white/45 to-transparent"
              />
              <tool.icon className="relative h-5 w-5 text-white" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-sm font-bold text-heading">{tool.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-subtle">{tool.description}</p>
            <Link
              href={tool.href}
              className="mt-4 flex w-full items-center justify-center rounded-xl border border-hairline py-2.5 text-sm font-bold text-heading transition-colors duration-200 group-hover:bg-btn-secondary-hover"
            >
              Try this out
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
