"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { APP_URL } from "@/lib/constants";

interface ToolCardData {
  title: string;
  image?: string;
  /** Crops the source screenshot to a shorter band instead of showing it in
   * full -- used to trim off a baked-in label from the source asset that a
   * card's own heading already makes redundant. */
  cropAspect?: string;
  cropPosition?: "top" | "bottom";
  footer?: ReactNode;
  /** Renders a looping video instead of a static screenshot. The clip's flat
   * gray backdrop is brightened to pure white here so it blends into this
   * card -- landing-page-only treatment, the source file is untouched. */
  video?: string;
  videoPoster?: string;
}

const ROW_1: ToolCardData[] = [
  { title: "Video Transcripts", image: "/tools/light/transcript.png" },
  { title: "AI Image Generator", image: "/tools/light/image-generator.png" },
  {
    title: "AI Voice Over",
    image: "/tools/light/voice-over.png",
    cropAspect: "960 / 400",
    cropPosition: "bottom",
  },
];

const ROW_2: ToolCardData[] = [
  { title: "Download Any Video", image: "/tools/light/downloader.png" },
  { title: "Niche Bend", image: "/tools/light/niche-bend.png" },
  { title: "Niche Finder", image: "/tools/light/niche-finder.png" },
];

const ROW_3: ToolCardData[] = [
  {
    title: "AI Script Writer",
    video: "/videos/script-generator.mp4",
    videoPoster: "/videos/script-generator-poster.jpg",
  },
  {
    title: "AI Video Generator",
    video: "/videos/ai-video-generator-marquee.mp4",
    videoPoster: "/videos/ai-video-generator-marquee-poster.jpg",
  },
];

function ToolCard({ title, image, cropAspect, cropPosition = "top", footer, video, videoPoster }: ToolCardData) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-hairline bg-white p-5 sm:p-6">
      <h3 className="text-lg font-bold tracking-tight text-heading sm:text-2xl">{title}</h3>
      <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-4">
        <div
          className="relative w-full"
          style={{ aspectRatio: cropAspect ?? "16 / 10" }}
        >
          {video ? (
            <video
              src={video}
              poster={videoPoster}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-contain"
              style={{ filter: "brightness(1.15) contrast(1.03)" }}
            />
          ) : (
            <Image
              src={image!}
              alt={title}
              fill
              sizes="(max-width: 768px) 90vw, 33vw"
              className={cropAspect ? "object-cover" : "object-contain"}
              style={cropAspect ? { objectPosition: cropPosition } : undefined}
            />
          )}
        </div>
        {footer}
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
            className="group relative isolate inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[radial-gradient(220%_220%_at_28%_18%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] px-9 py-3.5 text-lg font-bold text-white shadow-[0_4px_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_4px_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-[0_0_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] active:duration-100"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_50%_50%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
            />
            <span className="relative">Try Verlab Now</span>
            <ArrowRight className="relative h-4 w-4" />
          </a>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-2 sm:mt-10 sm:gap-2.5 md:grid-cols-3">
          {[...ROW_1, ...ROW_2].map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:mt-2.5 sm:gap-2.5 md:grid-cols-2 md:items-start">
          {ROW_3.map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>
      </div>
    </section>
  );
}
