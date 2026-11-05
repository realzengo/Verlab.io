"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import {
  DownloaderArt,
  ImageGeneratorArt,
  NicheBendingArt,
  NicheFinderArt,
  ScriptwriterArt,
  TranscriptArt,
  VideoGeneratorArt,
  VoiceoverArt,
} from "@/components/dashboard/ToolArt";
import { BUTTON_3D_MOTION, button3d } from "@/components/landing/button3d";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ToolCardData {
  title: string;
  description: string;
  /** Coded preview art shared with the app's tool cards (see ToolArt.tsx). */
  art: ReactNode;
}

const ROW_1: ToolCardData[] = [
  {
    title: "Video Transcripts",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video instantly.",
    art: <TranscriptArt />,
  },
  {
    title: "AI Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    art: <ImageGeneratorArt />,
  },
  {
    title: "AI Voice Over",
    description: "Turn scripts into natural-sounding voiceovers with AI voices in seconds.",
    art: <VoiceoverArt />,
  },
];

const ROW_2: ToolCardData[] = [
  {
    title: "Download Any Video",
    description: "Save TikTok, Reels, and Shorts videos to your device without the watermark.",
    art: <DownloaderArt />,
  },
  {
    title: "Niche Bend",
    description: "Reverse-engineer a winning channel's format and bend it into a fresh, non-competing niche.",
    art: <NicheBendingArt />,
  },
  {
    title: "Niche Finder",
    description: "Spot trending faceless niches and outlier videos before they get crowded.",
    art: <NicheFinderArt />,
  },
];

const ROW_3: ToolCardData[] = [
  {
    title: "AI Script Writer",
    description: "Create engaging scripts for your videos with AI-powered writing assistance.",
    art: <ScriptwriterArt />,
  },
  {
    title: "AI Video Generator",
    description: "Create, edit, and animate watermark-free AI videos from a text prompt or image.",
    art: <VideoGeneratorArt />,
  },
];

function ToolCard({ title, description, art }: ToolCardData) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#e9e9e9] bg-white">
      <div className="px-4 pt-4 sm:px-[18px] sm:pt-5">
        <h3 className="text-lg font-semibold leading-7 text-[#505050] sm:text-[20px]">{title}</h3>
        <p className="mt-0.5 text-[13.5px] leading-[18px] text-[#5c5c5f]">{description}</p>
      </div>
      {/* The art's 400x225 canvas scales up to 1.4x at most, so the slot caps at
          that height (315px) -- wide two-up cards get gray side margins instead
          of an empty band under the canvas. */}
      <div className="mt-auto p-3 pt-4">
        <div className="relative aspect-video max-h-[315px] w-full overflow-hidden rounded-lg">{art}</div>
      </div>
    </div>
  );
}

export function ShowcaseGridSection() {
  return (
    <section className="w-full pb-14 pt-16 sm:pb-20 sm:pt-28">
      <div className="mx-auto max-w-[96rem] px-5 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="ml-3 font-display text-[26px] font-bold leading-[1.15] tracking-[-0.015em] text-heading sm:ml-4 sm:text-3xl sm:leading-normal sm:tracking-tight md:text-5xl">
              Verlab has everything you need to go viral.
            </h2>
            <p className="ml-3 mt-0.5 text-sm text-subtle sm:ml-4 sm:text-base">
              One toolkit for every step, from finding a niche to shipping the video.
            </p>
          </div>
          <a
            href={APP_URL}
            className={cn("inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-9 py-3.5 text-lg font-bold text-white", BUTTON_3D_MOTION)}
            style={button3d(4)}
          >
            Try Verlab Now
            <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </a>
        </div>

        {/* Tray: one soft gray panel holding every card, 14px inset and 18px gutters. */}
        <div
          className="mt-8 rounded-2xl border border-[#f1f2f4] bg-[#fbfbfb] p-2.5 sm:mt-10 md:p-3.5"
          style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
        >
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-[18px]">
            {[...ROW_1, ...ROW_2].map((tool) => (
              <ToolCard key={tool.title} {...tool} />
            ))}
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:mt-[18px] md:grid-cols-2 md:gap-[18px]">
            {ROW_3.map((tool) => (
              <ToolCard key={tool.title} {...tool} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
