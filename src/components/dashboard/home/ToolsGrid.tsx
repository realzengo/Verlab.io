import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ToolTile } from "@/components/dashboard/ToolTile";
import { toolMenuItem } from "@/lib/mock-data";

// Each card's icon + tile colour is the tool's entry in the sidebar's Tools
// menu (TOOLS_MENU, matched by href), so a tool looks the same everywhere.
const TOOLS: { title: string; description: string; href: string }[] = [
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos without the watermark.",
    href: "/downloads",
  },
  {
    title: "Video Generator",
    description: "Create, edit, and animate watermark-free AI videos from a prompt or image.",
    href: "/video-generator",
  },
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images with AI.",
    href: "/image-generator",
  },
  {
    title: "Scriptwriter",
    description: "Write engaging video scripts with AI-powered writing assistance.",
    href: "/scripts",
  },
  {
    title: "Voiceover",
    description: "Turn scripts into natural-sounding AI voiceovers in seconds.",
    href: "/voiceover-generator",
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video.",
    href: "/transcripts",
  },
  {
    title: "Niche Bender",
    description: "Reverse-engineer a winning format and bend it into a fresh, non-competing niche.",
    href: "/bend",
  },
  {
    title: "Niche Finder",
    description: "Explore trending TikTok niches and creators with real performance data.",
    href: "/niches",
  },
  {
    title: "MCP",
    description: "Connect Verlab to Claude or ChatGPT and create from inside your AI chat.",
    href: "/mcp",
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
          className="mb-1 flex shrink-0 items-center gap-0.5 text-sm font-bold text-subtle transition-colors hover:text-primary"
        >
          View all tools
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {featured.map((tool) => {
          const menuEntry = toolMenuItem(tool.href);
          return (
            <div key={tool.title} className="group flex flex-col rounded-2xl border border-hairline bg-surface p-5">
              {menuEntry && <ToolTile icon={menuEntry.icon} tone={menuEntry.tone} size="lg" />}
              <h3 className="mt-4 text-sm font-bold text-heading">{tool.title}</h3>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-subtle">{tool.description}</p>
              <Link
                href={tool.href}
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-hairline py-2.5 text-sm font-bold text-heading transition-colors duration-200 group-hover:border-subtle/30 group-hover:bg-app"
              >
                Try this out
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
