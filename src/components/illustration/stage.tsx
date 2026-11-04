"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useAnimationGate } from "@/lib/hooks/useAnimationGate";
import { cn } from "@/lib/utils";

/* Shared pieces for coded product illustrations (the landing "How it works"
 * cards, the dashboard tool cards): a fixed design canvas scaled to its
 * slot, entrance variants, the brand tag, and a muted short-form clip. */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const TAG_CLASS =
  "inline-flex items-center gap-1 rounded-lg border border-[#8fa8ff] bg-[linear-gradient(155deg,#6d8dff_0%,#335cff_55%,#1c3fd6_100%)] font-bold text-white shadow-[0_6px_14px_-6px_rgba(51,92,255,0.75),inset_0_1px_0_rgba(255,255,255,0.35)]";

export function rise(delay: number, y = 12): Variants {
  return {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { delay, duration: 0.7, ease: EASE } },
  };
}

export function pop(delay: number): Variants {
  return {
    hidden: { opacity: 0, scale: 0.6 },
    show: { opacity: 1, scale: 1, transition: { delay, type: "spring", stiffness: 380, damping: 20 } },
  };
}

const StageInView = createContext(false);

/** A `width` × `height` design canvas scaled to its slot's width
 * (top-anchored). Plays its entrance once when scrolled into view; clips
 * and CSS loops inside run only while it's on screen (`.anim-gate`). */
export function Stage({
  width,
  height,
  className,
  background,
  children,
}: {
  width: number;
  height: number;
  className?: string;
  /** Painted edge to edge behind the scaled canvas. */
  background?: ReactNode;
  children: ReactNode;
}) {
  const { ref, inView } = useAnimationGate<HTMLDivElement>();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1.4, Math.max(0.45, entry.contentRect.width / width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, width]);

  return (
    <div ref={ref} data-inview={inView} className={cn("anim-gate absolute inset-0 overflow-hidden", className)} aria-hidden>
      {background}
      <div
        className="absolute left-1/2 top-0 origin-top"
        style={{ width, height, transform: `translateX(-50%) scale(${scale})` }}
      >
        <StageInView.Provider value={inView}>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.45 }} className="absolute inset-0">
            {children}
          </motion.div>
        </StageInView.Provider>
      </div>
    </div>
  );
}

/** A vertical short. With `video`, it plays muted while its stage is on
 * screen (never for reduced motion); otherwise it shows the poster. */
export function Short({ poster, video, sizes = "140px" }: { poster: string; video?: string; sizes?: string }) {
  const inView = useContext(StageInView);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (inView && !reduce) v.play().catch(() => {});
    else v.pause();
  }, [inView, reduce]);

  if (!video) return <Image src={poster} alt="" fill sizes={sizes} className="object-cover" />;
  return (
    <video
      ref={ref}
      src={video}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
