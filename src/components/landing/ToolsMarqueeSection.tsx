"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Wand2,
  Captions,
  Image as ImageIcon,
  Compass,
  ClipboardList,
  PenSquare,
  CloudCog,
  Plug,
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
}

const TOOLS: MarqueeTool[] = [
  { title: "Niche Bending", icon: Wand2, tone: "blue" },
  { title: "Transcript Extractor", icon: Captions, tone: "violet" },
  { title: "Image Generator", icon: ImageIcon, tone: "rose" },
  { title: "Niche Finder", icon: Compass, tone: "violet" },
  { title: "SOP Builder", icon: ClipboardList, tone: "sky" },
  { title: "Script Maker", icon: PenSquare, tone: "blue" },
  { title: "Cloud Library", icon: CloudCog, tone: "green" },
  { title: "MCP", icon: Plug, tone: "rose" },
];

// Autoplay speed in pixels/second. Runs continuously -- not pausable or
// draggable, so it always reads as ambient motion rather than a control.
const AUTOPLAY_SPEED = 45;

function ToolCard({ title, icon: Icon, tone }: MarqueeTool) {
  return (
    <Link
      href="/login"
      draggable={false}
      className="group flex h-[130px] w-[136px] shrink-0 flex-col rounded-2xl bg-slate-100 p-2.5 transition-colors hover:bg-slate-200 sm:h-[160px] sm:w-[220px] sm:p-3.5 md:h-[176px] md:w-[256px]"
    >
      <div className="relative mb-2.5 flex w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:mb-3">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-xl sm:h-10 sm:w-10", TOOL_TONE_CLASSES[tone])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} />
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-800 sm:text-sm">{title}</span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function ToolsMarqueeSection() {
  // Tripled so the user can drag/scroll either direction and still loop seamlessly.
  const track = [...TOOLS, ...TOOLS, ...TOOLS];

  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    // Content is 3 copies of TOOLS; start in the middle copy so the loop
    // has room to reset in either direction without a visible jump.
    const setWidth = () => el.scrollWidth / 3;
    el.scrollLeft = setWidth();

    let frame: number;
    let last = performance.now();

    const step = (now: number) => {
      const dt = now - last;
      last = now;

      el.scrollLeft += (AUTOPLAY_SPEED * dt) / 1000;

      const width = setWidth();
      if (el.scrollLeft >= width * 2) {
        el.scrollLeft -= width;
      } else if (el.scrollLeft <= 0) {
        el.scrollLeft += width;
      }

      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-white pt-2 pb-12 sm:pb-16">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-white to-transparent md:w-48" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-white to-transparent md:w-48" />

      <div ref={scrollerRef} className="no-scrollbar flex w-full select-none overflow-x-hidden">
        <div className="flex w-max gap-3 sm:gap-4 md:gap-6">
          {track.map((tool, i) => (
            <ToolCard key={i} {...tool} />
          ))}
        </div>
      </div>
    </section>
  );
}
