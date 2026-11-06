"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Captions, Clapperboard, Download, Image as ImageIcon, Mic2, PenLine, Scissors, Wand2 } from "lucide-react";
import { ToolGridCard, type ToolTone } from "@/components/dashboard/ToolGridCard";
import {
  DownloaderArt,
  ImageGeneratorArt,
  NicheBendingArt,
  ScriptwriterArt,
  TranscriptArt,
  VideoGeneratorArt,
  VoiceoverArt,
} from "@/components/dashboard/ToolArt";

// Each card's preview is coded art from ToolArt.tsx. A tool without `art`
// can still use a screenshot (`thumbnail`, /public/tools/<slug>.webp) or
// falls back to a tinted icon tile.
const TOOLS: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: ToolTone;
  badge?: string;
  art?: ReactNode;
  thumbnail?: string;
  thumbnailDark?: string;
}[] = [
  {
    title: "Niche Bending",
    description: "Reverse-engineer a winning channel's format and bend it into a fresh, non-competing niche.",
    href: "/bend",
    icon: Wand2,
    tone: "cat-7",
    art: <NicheBendingArt />,
  },
  {
    title: "Clipping",
    description: "Turn a long YouTube video into vertical, captioned clips of its most viral moments.",
    href: "/clipping",
    icon: Scissors,
    tone: "cat-2",
  },
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    href: "/image-generator",
    icon: ImageIcon,
    tone: "cat-3",
    art: <ImageGeneratorArt />,
  },
  {
    title: "Video Generator",
    description: "Create, edit, and animate watermark-free AI videos from a text prompt or image.",
    href: "/video-generator",
    icon: Clapperboard,
    tone: "cat-4",
    art: <VideoGeneratorArt />,
  },
  {
    title: "Scriptwriter",
    description: "Create engaging scripts for your videos with AI-powered writing assistance.",
    href: "/scripts",
    icon: PenLine,
    tone: "cat-6",
    art: <ScriptwriterArt />,
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video instantly.",
    href: "/transcripts",
    icon: Captions,
    tone: "cat-5",
    art: <TranscriptArt />,
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos to your device without the watermark.",
    href: "/downloads",
    icon: Download,
    tone: "cat-1",
    art: <DownloaderArt />,
  },
  {
    title: "Voiceover",
    description: "Turn scripts into natural-sounding voiceovers with AI voices in seconds.",
    href: "/voiceover-generator",
    icon: Mic2,
    tone: "cat-2",
    art: <VoiceoverArt />,
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
              art={tool.art}
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
