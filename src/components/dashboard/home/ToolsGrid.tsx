"use client";

import { useRef } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Captions,
  ChevronLeft,
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

type Tone = "cat-1" | "cat-2" | "cat-3" | "cat-4" | "cat-5" | "cat-6" | "cat-7";

// Base color + a close, slightly lighter tint of that same hue -- gradient
// runs light->base, and the tile's stroke is a solid version of the base
// color. Vivid, saturated "candy" stops rather than muted or pastel ones.
const TONE_COLORS: Record<Tone, { base: string; light: string }> = {
  "cat-1": { base: "#2563eb", light: "#4f8ef7" },
  "cat-2": { base: "#16a34a", light: "#34d16a" },
  "cat-3": { base: "#db2777", light: "#f0509e" },
  "cat-4": { base: "#d97706", light: "#f3a13a" },
  "cat-5": { base: "#0d9488", light: "#34c9be" },
  "cat-6": { base: "#ea580c", light: "#fb8b3d" },
  "cat-7": { base: "#7c3aed", light: "#9f75f0" },
};

const TOOLS: { title: string; description: string; href: string; icon: LucideIcon; tone: Tone }[] = [
  {
    title: "Niche Bender",
    description: "Reverse-engineer a winning format and bend it into a fresh, non-competing niche.",
    href: "/bend",
    icon: Wand2,
    tone: "cat-7",
  },
  {
    title: "Video Generator",
    description: "Create, edit, and animate watermark-free AI videos from a prompt or image.",
    href: "/video-generator",
    icon: Clapperboard,
    tone: "cat-4",
  },
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images with AI.",
    href: "/image-generator",
    icon: ImageIcon,
    tone: "cat-3",
  },
  {
    title: "Scriptwriter",
    description: "Write engaging video scripts with AI-powered writing assistance.",
    href: "/scripts",
    icon: PenLine,
    tone: "cat-6",
  },
  {
    title: "Voiceover",
    description: "Turn scripts into natural-sounding AI voiceovers in seconds.",
    href: "/voiceover-generator",
    icon: Mic2,
    tone: "cat-2",
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video.",
    href: "/transcripts",
    icon: Captions,
    tone: "cat-5",
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos without the watermark.",
    href: "/downloads",
    icon: Download,
    tone: "cat-1",
  },
  {
    title: "Niche Finder",
    description: "Explore trending TikTok niches and creators with real performance data.",
    href: "/niches",
    icon: Compass,
    tone: "cat-7",
  },
  {
    title: "MCP",
    description: "Connect Verlab to Claude or ChatGPT and create from inside your AI chat.",
    href: "/mcp",
    icon: Plug,
    tone: "cat-3",
  },
];

export function ToolsGrid() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section>
      <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">Browse our tools</h2>
      <p className="mt-1 text-sm text-subtle">A step-by-step guide to using our tools</p>

      <div className="relative mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollBy(-320)}
          aria-label="Scroll tools left"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-subtle shadow-card transition-colors hover:text-heading sm:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
        >
          {TOOLS.map((tool) => (
            <div
              key={tool.title}
              className="flex w-64 shrink-0 snap-start flex-col rounded-2xl border border-hairline bg-surface p-5 sm:w-72 lg:w-[calc((100%-4rem)/5)]"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl border-2 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${TONE_COLORS[tool.tone].light} 0%, ${TONE_COLORS[tool.tone].base} 100%)`,
                  borderColor: TONE_COLORS[tool.tone].base,
                }}
              >
                <tool.icon className="h-5 w-5 text-white" strokeWidth={1.8} />
              </span>
              <h3 className="mt-4 text-sm font-bold text-heading">{tool.title}</h3>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-subtle">{tool.description}</p>
              <Link
                href={tool.href}
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-hairline py-2.5 text-sm font-bold text-heading shadow-sm transition-colors hover:border-heading/15"
              >
                Try this out
              </Link>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollBy(320)}
          aria-label="Scroll tools right"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-subtle shadow-card transition-colors hover:text-heading sm:flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
