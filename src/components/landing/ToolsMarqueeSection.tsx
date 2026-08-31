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

interface MarqueeTool {
  title: string;
  icon: LucideIcon;
}

const TOOLS: MarqueeTool[] = [
  { title: "Niche Bending", icon: Wand2 },
  { title: "Transcript Extractor", icon: Captions },
  { title: "Image Generator", icon: ImageIcon },
  { title: "Script Maker", icon: PenSquare },
  { title: "Video Generator", icon: Clapperboard },
  { title: "Downloader", icon: Download },
  { title: "Voiceover Generator", icon: Mic2 },
];

function ToolCard({ title, icon: Icon }: MarqueeTool) {
  return (
    <Link
      href="/login"
      draggable={false}
      className="flex h-[130px] w-[158px] shrink-0 flex-col rounded-card border border-[#E0E4F2] bg-white p-2.5 sm:h-[160px] sm:w-[220px] sm:p-3.5 md:h-[176px] md:w-[256px]"
    >
      <div className="relative mb-2.5 flex w-full flex-1 items-center justify-center overflow-hidden rounded-card-sm bg-slate-100 sm:mb-3">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />
        <span
          className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[22%] bg-gradient-to-b from-[#6EA8FF] to-[#2258E8] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),inset_0_-8px_12px_-2px_rgba(10,30,120,0.45)] sm:h-11 sm:w-11 md:h-12 md:w-12"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-1/2 rounded-t-[22%] bg-gradient-to-b from-white/45 to-transparent"
          />
          <Icon className="relative h-4 w-4 text-white sm:h-5 sm:w-5 md:h-6 md:w-6" strokeWidth={2} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold tracking-tight text-slate-800 sm:text-sm sm:tracking-normal">
          {title}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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
    <section className="w-full overflow-hidden bg-[#F8F9FC] pt-2 pb-12 sm:pb-16">
      <div className="relative mx-auto max-w-[1600px] px-6 md:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#F8F9FC] to-transparent sm:w-14 md:w-20" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#F8F9FC] to-transparent sm:w-14 md:w-20" />

        <div ref={scrollerRef} className="no-scrollbar flex w-full select-none overflow-x-hidden">
          <div ref={trackRef} className="flex w-max gap-3 will-change-transform sm:gap-4 md:gap-6">
            {track.map((tool, i) => (
              <ToolCard key={i} {...tool} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
