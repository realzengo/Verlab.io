"use client";

import type { LucideIcon } from "lucide-react";
import { Captions, Clapperboard, Download, Image as ImageIcon, Mic2, PenLine, Wand2 } from "lucide-react";
import { ToolGridCard, type ToolTone } from "@/components/dashboard/ToolGridCard";

// Thumbnails: drop a screenshot/mockup at /public/tools/<slug>.png and set
// `thumbnail` below to "/tools/<slug>.png" -- cards fall back to a tinted
// icon tile until then, so this can be filled in one tool at a time.
const TOOLS: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: ToolTone;
  badge?: string;
  thumbnail?: string;
  thumbnailDark?: string;
}[] = [
  {
    title: "Niche Bending",
    description: "Reverse-engineer a winning channel's format and bend it into a fresh, non-competing niche.",
    href: "/bend",
    icon: Wand2,
    tone: "cat-7",
    thumbnail: "/tools/niche-bending.webp",
    thumbnailDark: "/tools/niche-bending-dark.webp",
  },
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    href: "/image-generator",
    icon: ImageIcon,
    tone: "cat-3",
    thumbnail: "/tools/image-generator.webp",
    thumbnailDark: "/tools/image-generator-dark.webp",
  },
  {
    title: "Video Generator",
    description: "Create, edit, and animate watermark-free AI videos from a text prompt or image.",
    href: "/video-generator",
    icon: Clapperboard,
    tone: "cat-4",
    thumbnail: "/tools/video-generator.webp",
    thumbnailDark: "/tools/video-generator-dark.webp",
  },
  {
    title: "Scriptwriter",
    description: "Create engaging scripts for your videos with AI-powered writing assistance.",
    href: "/scripts",
    icon: PenLine,
    tone: "cat-6",
    thumbnail: "/tools/scriptwriter.webp",
    thumbnailDark: "/tools/scriptwriter-dark.webp",
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video instantly.",
    href: "/transcripts",
    icon: Captions,
    tone: "cat-5",
    thumbnail: "/tools/transcript-extractor.webp",
    thumbnailDark: "/tools/transcript-extractor-dark.webp",
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos to your device without the watermark.",
    href: "/downloads",
    icon: Download,
    tone: "cat-1",
    thumbnail: "/tools/downloader.webp",
    thumbnailDark: "/tools/downloader-dark.webp",
  },
  {
    title: "Voiceover",
    description: "Turn scripts into natural-sounding voiceovers with AI voices in seconds.",
    href: "/voiceover-generator",
    icon: Mic2,
    tone: "cat-2",
    thumbnail: "/tools/voiceover.webp",
    thumbnailDark: "/tools/voiceover-dark.webp",
  },
];

export default function ToolsPage() {
  return (
    <div className="flex w-full flex-col items-center gap-2 pt-2">
      <div className="w-full">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4 sm:gap-5">
          {TOOLS.map((tool, index) => (
            <ToolGridCard
              key={tool.title}
              title={tool.title}
              description={tool.description}
              href={tool.href}
              icon={tool.icon}
              tone={tool.tone}
              badge={tool.badge}
              thumbnail={tool.thumbnail}
              thumbnailDark={tool.thumbnailDark}
              priority={index < 3}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
