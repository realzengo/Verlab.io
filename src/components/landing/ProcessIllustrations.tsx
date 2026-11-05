"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Play, ScanLine, Scissors, Search, TrendingUp } from "lucide-react";
import { EASE, Short, Stage as BaseStage, TAG_CLASS, pop, rise } from "@/components/illustration/stage";
import { cn } from "@/lib/utils";

/* Coded stages for the three "How it works" cards: real vertical shorts and
 * white frosted surfaces with brand-blue tags, drawn for the light card they
 * sit in, on a fixed 400 × 340 canvas. The three follow one short through
 * the flow: step 1 spots the Einstein clip as an outlier,
 * step 2 pulls its formula and strips the topic, step 3 bends that formula
 * onto Babe Ruth and ships it everywhere. */

const STAGE_W = 400;
const STAGE_H = 340;

const EINSTEIN = { video: "/videos/einstein.mp4", poster: "/videos/einstein-poster.jpg" };
const BABE_RUTH = { video: "/videos/babe-ruth.mp4", poster: "/videos/babe-ruth-poster.jpg" };

const GLASS_SHADOW =
  "inset 0 1px 0 #fff, 0 0 0 1px rgba(15,23,42,0.06), 0 24px 44px -22px rgba(15,23,42,0.32), 0 4px 12px -4px rgba(15,23,42,0.08)";
const PILL_SHADOW =
  "inset 0 1px 0 #fff, 0 0 0 1px rgba(15,23,42,0.06), 0 12px 26px -12px rgba(15,23,42,0.3), 0 2px 6px -2px rgba(15,23,42,0.08)";

function Stage({ children }: { children: ReactNode }) {
  return (
    <BaseStage width={STAGE_W} height={STAGE_H} className="font-ui">
      {children}
    </BaseStage>
  );
}

function Glass({
  pill,
  className,
  style,
  children,
}: {
  pill?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white/90 backdrop-blur-md",
        pill ? "rounded-full" : "rounded-2xl",
        className
      )}
      style={{ boxShadow: pill ? PILL_SHADOW : GLASS_SHADOW, ...style }}
    >
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function Views({ children, large }: { children: ReactNode; large?: boolean }) {
  return (
    <span
      className={cn(
        "absolute flex items-center gap-1 rounded-full border border-white/20 bg-black/65 font-semibold leading-none text-white",
        large ? "bottom-2 left-2 px-2 py-1 text-[11px]" : "bottom-1.5 left-1.5 px-1.5 py-[3px] text-[9px]"
      )}
    >
      <Play className={cn("fill-white", large ? "h-2.5 w-2.5" : "h-2 w-2")} strokeWidth={0} />
      {children}
    </span>
  );
}

/** White ring plus a soft neutral drop shadow lifting the focused clip. */
const FOCUS_RING =
  "ring-[3px] ring-white shadow-[0_0_0_4px_rgba(15,23,42,0.05),0_24px_48px_-18px_rgba(15,23,42,0.3),0_10px_20px_-10px_rgba(15,23,42,0.16)]";

/* ─── Step 1 · Find a Viral Niche ─────────────────────────────────────── */

const SIDE_CLIPS = [
  { poster: "/videos/braces-poster.jpg", views: "61K", left: -58 },
  { poster: "/videos/misc-poster.jpg", views: "84K", left: 42 },
  { poster: "/videos/school-college-poster.jpg", views: "120K", left: 270 },
  { poster: "/videos/cat-poster.jpg", views: "97K", left: 370 },
];

export function NicheIllustration() {
  return (
    <Stage>
      <div className="absolute inset-x-0 top-[18px] flex justify-center">
        <motion.div variants={rise(0, -8)}>
          <Glass pill className="h-[38px] w-[248px]">
            <div className="flex h-full items-center justify-between pl-4 pr-[5px]">
              <span className="text-[13px] font-semibold text-[#111827]">Interesting facts</span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#335cff] shadow-[0_4px_12px_-3px_rgba(51,92,255,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
                <Search className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </span>
            </div>
          </Glass>
        </motion.div>
      </div>

      {SIDE_CLIPS.map((clip, i) => (
        <motion.div
          key={clip.poster}
          variants={rise(0.15 + i * 0.06)}
          className="absolute overflow-hidden rounded-[12px] bg-slate-200 shadow-[0_12px_24px_-14px_rgba(15,23,42,0.4)] ring-1 ring-black/5"
          style={{ left: clip.left, top: 105, width: 88, height: 156 }}
        >
          <Short poster={clip.poster} />
          <div className="absolute inset-0 bg-white/35" />
          <Views>{clip.views}</Views>
        </motion.div>
      ))}
      <motion.div
        variants={rise(0.45, 18)}
        className={cn("absolute overflow-hidden rounded-[14px] bg-slate-800", FOCUS_RING)}
        style={{ left: 142, top: 80, width: 116, height: 206 }}
      >
        <Short {...EINSTEIN} />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        <Image
          src="/logos/social/tiktok.png"
          alt=""
          width={18}
          height={18}
          className="absolute left-2 top-2 h-[18px] w-[18px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        />
        <Views large>2.4M views</Views>
      </motion.div>

      <motion.span
        variants={pop(1.0)}
        className={cn(TAG_CLASS, "absolute h-6 px-2 text-[11px]")}
        style={{ left: 214, top: 68 }}
      >
        <TrendingUp className="h-3 w-3" strokeWidth={3} />
        38× outlier
      </motion.span>
    </Stage>
  );
}

/* ─── Step 2 · Extract the Formula ────────────────────────────────────── */

const TIMELINE = [
  { grow: 18, color: "#4f74ff" },
  { grow: 52, color: "#8aa5ff" },
  { grow: 30, color: "#c6d4ff" },
];

function FormulaRow({ tag, delay, children }: { tag: string; delay: number; children: ReactNode }) {
  return (
    <motion.div variants={rise(delay, 6)} className="mt-3">
      <span className={cn(TAG_CLASS, "h-[18px] rounded-[5px] px-1.5 text-[10px]")}>{tag}</span>
      <div className="mt-1.5 flex items-center gap-1 text-[12.5px] font-medium leading-[1.3] text-[#374151]">{children}</div>
    </motion.div>
  );
}

export function FormulaIllustration() {
  return (
    <Stage>
      <motion.div
        variants={rise(0, 16)}
        className={cn("absolute overflow-hidden rounded-[14px] bg-slate-800", FOCUS_RING)}
        style={{ left: 28, top: 32, width: 132, height: 235 }}
      >
        <Short {...EINSTEIN} />
        {/* scan pass over the clip */}
        <div className="process-scan absolute inset-0">
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#335cff]/45" />
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[#a9bdff] shadow-[0_0_12px_2px_rgba(120,155,255,0.9)]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-2 bottom-2 flex gap-[3px]">
          {TIMELINE.map((s, i) => (
            <motion.span
              key={i}
              className="block h-1 rounded-full"
              style={{ flexGrow: s.grow, flexBasis: 0, background: s.color, originX: 0 }}
              variants={{
                hidden: { scaleX: 0 },
                show: { scaleX: 1, transition: { delay: 0.5 + i * 0.25, duration: 0.5, ease: EASE } },
              }}
            />
          ))}
        </div>
      </motion.div>

      <motion.div variants={rise(0.3, 14)} className="absolute" style={{ left: 150, top: 60, width: 224 }}>
        <Glass className="px-3.5 pb-4 pt-3.5">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
            <ScanLine className="h-4 w-4 text-[#335cff]" />
            Formula
          </div>
          <FormulaRow tag="Hook" delay={0.6}>
            Nobody talks about
            <motion.span
              variants={pop(1.1)}
              className="inline-flex h-5 items-center rounded-md border-[1.5px] border-dashed border-[#335cff] bg-[#eef2ff] px-1.5 text-[11.5px] font-semibold text-[#335cff]"
            >
              topic
            </motion.span>
          </FormulaRow>
          <FormulaRow tag="Pattern" delay={0.75}>
            3 facts · 1.4s cuts
          </FormulaRow>
          <FormulaRow tag="Payoff" delay={0.9}>
            Twist reveal at 0:08
          </FormulaRow>
        </Glass>
      </motion.div>

      {/* the topic, cut out of the hook */}
      <motion.div
        variants={{
          hidden: { opacity: 0, x: -90, y: 70, rotate: 0 },
          show: { opacity: 1, x: 0, y: 0, rotate: -6, transition: { delay: 1.3, duration: 0.9, ease: EASE } },
        }}
        className="absolute"
        style={{ left: 272, top: 42 }}
      >
        <Glass pill className="h-8">
          <div className="flex h-full items-center gap-1.5 pl-2.5 pr-3.5">
            <Scissors className="h-3.5 w-3.5 text-[#94a3b8]" strokeWidth={2.25} />
            <span className="text-[12px] font-semibold text-[#6b7280] line-through decoration-[#f87171] decoration-2">
              Einstein
            </span>
          </div>
        </Glass>
      </motion.div>
    </Stage>
  );
}

/* ─── Step 3 · Bend & Dominate ────────────────────────────────────────── */

const PLATFORMS = [
  { logo: "/logos/social/tiktok.png", views: "1.2M", left: 40, top: 112, delay: 1.0, float: "0s" },
  { logo: "/logos/social/youtube.png", views: "860K", left: 248, top: 168, delay: 1.15, float: "-2.3s" },
  { logo: "/logos/social/instagram.png", views: "540K", left: 52, top: 228, delay: 1.3, float: "-4.6s" },
];

export function BendIllustration() {
  return (
    <Stage>
      <div className="absolute inset-x-0 top-[18px] flex justify-center">
        <motion.div variants={rise(0, -8)}>
          <Glass pill className="h-[38px]">
            <div className="flex h-full items-center gap-2 pl-[5px] pr-[5px]">
              <span className="inline-flex h-7 items-center rounded-full bg-[#f3f4f6] px-3 text-[12px] font-semibold text-[#9ca3af] line-through decoration-[#9ca3af] decoration-[1.5px]">
                Einstein
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-[#9ca3af]" strokeWidth={2.5} />
              <motion.span variants={pop(0.55)} className={cn(TAG_CLASS, "h-7 rounded-full px-3 text-[12px]")}>
                Babe Ruth
              </motion.span>
            </div>
          </Glass>
        </motion.div>
      </div>
      <motion.div
        variants={rise(0.3, 18)}
        className={cn("absolute overflow-hidden rounded-[14px] bg-slate-800", FOCUS_RING)}
        style={{ left: 138, top: 76, width: 124, height: 220 }}
      >
        <Short {...BABE_RUTH} />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-2 left-2 text-[10px] font-semibold uppercase tracking-wider text-white/80">
          New script
        </span>
      </motion.div>

      <motion.span
        variants={pop(0.8)}
        className={cn(TAG_CLASS, "absolute h-6 px-2 text-[11px] italic")}
        style={{ left: 236, top: 64 }}
      >
        Bend
      </motion.span>

      {PLATFORMS.map((p) => (
        <motion.div key={p.logo} variants={pop(p.delay)} className="absolute" style={{ left: p.left, top: p.top }}>
          <div className="animate-float-soft" style={{ animationDelay: p.float }}>
            <Glass pill className="h-10">
              <div className="flex h-full items-center gap-2 pl-[7px] pr-3.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f3f4f6]">
                  <Image src={p.logo} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                </span>
                <span className="leading-none">
                  <span className="block text-[13px] font-bold text-[#111827]">+{p.views}</span>
                  <span className="mt-0.5 block text-[10px] font-medium text-[#6b7280]">views</span>
                </span>
              </div>
            </Glass>
          </div>
        </motion.div>
      ))}
    </Stage>
  );
}
