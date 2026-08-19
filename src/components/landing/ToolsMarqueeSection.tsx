"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Wand2,
  Captions,
  Image as ImageIcon,
  PenSquare,
  Clapperboard,
  Download,
  Mic2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { ToolTone } from "@/lib/types";
import { TOOL_TONE_CLASSES } from "@/lib/tone";
import { cn } from "@/lib/utils";

interface MarqueeTool {
  title: string;
  icon: LucideIcon;
  tone: ToolTone;
  video?: string;
  videoPoster?: string;
}

const TOOLS: MarqueeTool[] = [
  {
    title: "Niche Bending",
    icon: Wand2,
    tone: "blue",
    video: "/videos/niche-bender.mp4",
    videoPoster: "/videos/niche-bender-poster.jpg",
  },
  {
    title: "Transcript Extractor",
    icon: Captions,
    tone: "violet",
    video: "/videos/transcript-extractor.mp4",
    videoPoster: "/videos/transcript-extractor-poster.jpg",
  },
  {
    title: "Image Generator",
    icon: ImageIcon,
    tone: "rose",
    video: "/videos/image-generator.mp4",
    videoPoster: "/videos/image-generator-poster.jpg",
  },
  {
    title: "Script Maker",
    icon: PenSquare,
    tone: "blue",
    video: "/videos/scriptwriter.mp4",
    videoPoster: "/videos/scriptwriter-poster.jpg",
  },
  {
    title: "Video Generator",
    icon: Clapperboard,
    tone: "orange",
    video: "/videos/video-generator.mp4",
    videoPoster: "/videos/video-generator-poster.jpg",
  },
  {
    title: "Downloader",
    icon: Download,
    tone: "sky",
    video: "/videos/downloader.mp4",
    videoPoster: "/videos/downloader-poster.jpg",
  },
  {
    title: "Voiceover Generator",
    icon: Mic2,
    tone: "green",
    video: "/videos/voiceover-generator.mp4",
    videoPoster: "/videos/voiceover-generator-poster.jpg",
  },
];

function ToolCard({ title, icon: Icon, tone, video, videoPoster }: MarqueeTool) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // The track is tripled for a seamless infinite loop, so most copies of
  // each video are off-screen at any moment. Autoplaying all of them at
  // once forces the browser to fetch every clip immediately on page load
  // (this section carries 5MB+ videos) -- only play the copies that are
  // actually visible, same approach as VideoMarqueeSection's VideoCard.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Link
      href="/login"
      draggable={false}
      className="group flex h-[130px] w-[136px] shrink-0 flex-col rounded-2xl bg-[#EDF3FA] p-2.5 sm:h-[160px] sm:w-[220px] sm:p-3.5 md:h-[176px] md:w-[256px]"
    >
      <div className="relative mb-2.5 flex w-full flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#EDF3FA] sm:mb-3">
        {video ? (
          <video
            ref={videoRef}
            src={video}
            poster={videoPoster}
            className="h-full w-full object-cover"
            loop
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-xl sm:h-10 sm:w-10", TOOL_TONE_CLASSES[tone])}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-800 transition-colors group-hover:text-blue-600 sm:text-sm">{title}</span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-blue-600" />
      </div>
    </Link>
  );
}

export function ToolsMarqueeSection() {
  // Tripled so the user can drag/scroll either direction and still loop seamlessly.
  const track = [...TOOLS, ...TOOLS, ...TOOLS];

  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = trackRef.current;
    if (!scroller || !el) return;

    const cards = Array.from(el.children) as HTMLElement[];
    if (cards.length < 2) return;

    // Distance from one card to the next (width + gap), measured from real
    // layout so it stays correct across the responsive card-size breakpoints.
    const cardStep = () => cards[1].offsetLeft - cards[0].offsetLeft;

    // Content is 3 copies of TOOLS; start in the middle copy so the loop
    // has room to reset in either direction without a visible jump.
    let index = TOOLS.length;

    // Keeps the current card horizontally centered in the visible track
    // instead of pinned to the left edge.
    const offsetFor = (i: number) => (scroller.clientWidth - cards[i].offsetWidth) / 2 - cardStep() * i;

    const jumpTo = (i: number) => {
      el.style.transition = "none";
      el.style.transform = `translateX(${offsetFor(i)}px)`;
      void el.offsetWidth;
    };
    jumpTo(index);

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(scroller);

    let advanceTimeout: number;
    let resetTimeout: number;

    const advance = () => {
      if (visible) {
        index += 1;
        el.style.transition = "transform 700ms cubic-bezier(0.65,0,0.35,1)";
        el.style.transform = `translateX(${offsetFor(index)}px)`;

        resetTimeout = window.setTimeout(() => {
          if (index >= TOOLS.length * 2) {
            index -= TOOLS.length;
            jumpTo(index);
          }
        }, 700);
      }

      advanceTimeout = window.setTimeout(advance, 4000);
    };
    advanceTimeout = window.setTimeout(advance, 4000);

    return () => {
      window.clearTimeout(advanceTimeout);
      window.clearTimeout(resetTimeout);
      observer.disconnect();
    };
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-white pt-2 pb-12 sm:pb-16">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-white to-transparent md:w-48" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-white to-transparent md:w-48" />

      <div ref={scrollerRef} className="no-scrollbar flex w-full select-none overflow-x-hidden">
        <div ref={trackRef} className="flex w-max gap-3 will-change-transform sm:gap-4 md:gap-6">
          {track.map((tool, i) => (
            <ToolCard key={i} {...tool} />
          ))}
        </div>
      </div>
    </section>
  );
}
