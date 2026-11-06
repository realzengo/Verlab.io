"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Copy, Link2 } from "lucide-react";
import { EASE, Stage, TAG_CLASS, rise } from "@/components/illustration/stage";
import { cn } from "@/lib/utils";

/* Coded art for the affiliate "How it works" cards: white surfaces with
 * brand-blue accents on the card's light-blue wash, drawn on a fixed
 * 300 × 150 canvas fitted whole into the slot. Each runs one 6s loop
 * (affiliate-art-* in globals.css, paused off screen by the Stage's
 * .anim-gate): the cursor fills in and submits an application that gets
 * approved, copies the referral link out to a video, a bio and a post, and
 * two commissions land on this month's earnings. */

const W = 300;
const H = 150;

const SHADOW =
  "inset 0 1px 0 #fff, 0 0 0 1px rgba(15,23,42,0.06), 0 18px 34px -20px rgba(15,23,42,0.32), 0 3px 10px -4px rgba(15,23,42,0.08)";

const BLUE_FILL =
  "bg-[linear-gradient(180deg,#4a6fff_0%,#335cff_100%)] text-white shadow-[0_4px_12px_-4px_rgba(51,92,255,0.7),inset_0_1px_0_rgba(255,255,255,0.3)]";

/** Sets CSS custom properties inline (packet targets, animation delays). */
function vars(v: Record<string, string | number>): CSSProperties {
  return v as CSSProperties;
}

function ArtStage({ children }: { children: ReactNode }) {
  return (
    <Stage
      width={W}
      height={H}
      fit="contain"
      className="font-ui"
      background={
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(51,92,255,0.2) 0.8px, transparent 1.2px)",
            backgroundSize: "8px 8px",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
          }}
        />
      }
    >
      {children}
    </Stage>
  );
}

function Surface({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative bg-white", className)} style={{ boxShadow: SHADOW }}>
      {children}
    </div>
  );
}

/** Arrow pointer whose tip sits on the element's origin, so its loop
 * translates straight to the target point. */
function Cursor({ className }: { className: string }) {
  return (
    <span className={cn("absolute left-[-1px] top-[-1px] z-10 origin-top-left", className)}>
      <svg width="14" height="19" viewBox="0 0 14 19" className="drop-shadow-[0_2px_3px_rgba(15,23,42,0.35)]">
        <path
          d="M1 1v14.5l3.6-3.4 2.4 5.6 2.6-1.1-2.4-5.5H12L1 1z"
          fill="#111827"
          stroke="#fff"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ─── Step 1 · Apply ──────────────────────────────────────────────────── */

const APPLY_PLATFORMS = [
  { logo: "/logos/social/tiktok.png", pick: "affiliate-art-pick-1" },
  { logo: "/logos/social/youtube.png", pick: "affiliate-art-pick-2" },
  { logo: "/logos/social/instagram.png", pick: null },
];

export function ApplyArt() {
  return (
    <ArtStage>
      <motion.div variants={rise(0, 10)} className="absolute" style={{ left: 60, top: 15, width: 180 }}>
        <Surface className="rounded-2xl p-3">
          <div className="flex h-[22px] items-center gap-2">
            <span className="relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded-full ring-1 ring-black/5">
              <Image src="/reviewers/reviewer-03.jpeg" alt="" fill sizes="44px" className="object-cover object-top" />
            </span>
            <span className="leading-none">
              <span className="block text-[10.5px] font-semibold text-[#111827]">Alex Rivera</span>
              <span className="mt-[3px] block text-[8.5px] font-medium text-[#6b7280]">Partner application</span>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {APPLY_PLATFORMS.map((p) => (
              <span key={p.logo} className="relative grid h-6 place-items-center rounded-lg bg-[#f3f4f6]">
                {p.pick && (
                  <span className={cn("absolute inset-0 rounded-lg bg-[#eef2ff] ring-[1.5px] ring-[#335cff]", p.pick)}>
                    <span className="absolute -right-1 -top-1 grid h-3 w-3 place-items-center rounded-full bg-[#335cff]">
                      <Check className="h-2 w-2 text-white" strokeWidth={4} />
                    </span>
                  </span>
                )}
                <Image src={p.logo} alt="" width={14} height={14} className="relative h-3.5 w-3.5 object-contain" />
              </span>
            ))}
          </div>

          <div className={cn("affiliate-art-press-apply relative mt-3 h-[26px] rounded-lg text-[10px] font-semibold", BLUE_FILL)}>
            <span className="affiliate-art-label-out absolute inset-0 grid place-items-center">Submit application</span>
            <span className="affiliate-art-label-in absolute inset-0 flex items-center justify-center gap-1">
              <Check className="h-3 w-3" strokeWidth={3} />
              Submitted
            </span>
          </div>
        </Surface>
      </motion.div>

      <span className="absolute rotate-[4deg]" style={{ left: 186, top: 5 }}>
        <span className={cn(TAG_CLASS, "affiliate-art-approved h-[22px] px-2 text-[10.5px]")}>
          <Check className="h-3 w-3" strokeWidth={3} />
          Approved
        </span>
      </span>

      <Cursor className="affiliate-art-cursor-apply" />
    </ArtStage>
  );
}

/* ─── Step 2 · Share your link ────────────────────────────────────────── */

// Each target's centre x; the link leaves the pill at (150, 50) and lands
// on the target's top edge at y 92.
const SHARE_TARGETS = [
  { logo: "/logos/social/youtube.png", label: "Video", x: 66 },
  { logo: "/logos/social/instagram.png", label: "Bio", x: 150 },
  { logo: "/logos/social/tiktok.png", label: "Post", x: 234 },
];

export function ShareArt() {
  return (
    <ArtStage>
      <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        {SHARE_TARGETS.map((t) => (
          <path
            key={t.x}
            d={`M150 50 L${t.x} 92`}
            stroke="#335cff"
            strokeOpacity="0.4"
            strokeWidth="1.5"
            strokeDasharray="4 5"
            strokeLinecap="round"
            className="tool-art-dash"
          />
        ))}
      </svg>

      <motion.div variants={rise(0, -8)} className="absolute" style={{ left: 46, top: 12, width: 208 }}>
        <Surface className="flex h-9 items-center gap-2 rounded-full pl-[5px] pr-1">
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#eef2ff]">
            <Link2 className="h-3.5 w-3.5 text-[#335cff]" strokeWidth={2.5} />
          </span>
          <span className="flex-1 truncate text-[11.5px] font-semibold text-[#111827]">
            verlab.io/r/<span className="text-[#335cff]">alex</span>
          </span>
          <span className={cn("affiliate-art-press-copy relative grid h-7 w-7 shrink-0 place-items-center rounded-full", BLUE_FILL)}>
            <Copy className="affiliate-art-copy absolute h-3.5 w-3.5" strokeWidth={2.5} />
            <Check className="affiliate-art-copied absolute h-3.5 w-3.5" strokeWidth={3} />
          </span>
        </Surface>
      </motion.div>

      {SHARE_TARGETS.map((t, i) => {
        const delay = { animationDelay: `${i * 0.18}s` };
        return (
          <div key={t.x}>
            <span
              className="affiliate-art-packet absolute h-2 w-2 rounded-full bg-[#335cff] shadow-[0_0_0_2px_#fff,0_0_10px_2px_rgba(51,92,255,0.55)]"
              style={{ left: 146, top: 46, ...delay, ...vars({ "--dx": `${t.x - 150}px`, "--dy": "42px" }) }}
            />
            <motion.div
              variants={rise(0.15 + i * 0.08, 10)}
              className="absolute"
              style={{ left: t.x - 32, top: 94, width: 64, height: 42 }}
            >
              <div className="affiliate-art-hit relative h-full" style={delay}>
                <Surface className="flex h-full flex-col items-center justify-center gap-[3px] rounded-xl">
                  <Image src={t.logo} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                  <span className="text-[9px] font-semibold leading-none text-[#6b7280]">{t.label}</span>
                </Surface>
                <span className="affiliate-art-linked absolute inset-0 rounded-xl ring-[1.5px] ring-[#335cff]" style={delay} />
                <span
                  className={cn("affiliate-art-linked-badge absolute -right-[5px] -top-[5px] grid h-4 w-4 place-items-center rounded-full", BLUE_FILL)}
                  style={delay}
                >
                  <Link2 className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              </div>
            </motion.div>
          </div>
        );
      })}

      <Cursor className="affiliate-art-cursor-share" />
    </ArtStage>
  );
}

/* ─── Step 3 · Earn every month ───────────────────────────────────────── */

// Earlier months, oldest first; this month's bar grows in the loop.
const PAST_MONTHS = [14, 20, 26, 32, 38];
const TOTALS = ["$1,224.60", "$1,254.30", "$1,284.00"];

export function EarnArt() {
  return (
    <ArtStage>
      <motion.div variants={rise(0, 10)} className="absolute" style={{ left: 36, top: 10, width: 228, height: 130 }}>
        <Surface className="flex h-full flex-col rounded-2xl p-3">
          <span className="block text-[9px] font-semibold uppercase leading-none tracking-[0.6px] text-[#6b7280]">
            This month
          </span>
          <span className="mt-1.5 block h-5 overflow-hidden">
            <span className="affiliate-art-total block">
              {TOTALS.map((total) => (
                <span key={total} className="block h-5 text-[17px] font-bold leading-5 tracking-[-0.4px] text-[#111827]">
                  {total}
                </span>
              ))}
            </span>
          </span>

          <div className="mt-auto flex h-[60px] items-end justify-between px-1">
            {PAST_MONTHS.map((h, i) => (
              <motion.span
                key={i}
                className="block w-6 rounded-[5px] bg-[#dbe2ff]"
                style={{ height: h, originY: 1 }}
                variants={{
                  hidden: { scaleY: 0 },
                  show: { scaleY: 1, transition: { delay: 0.2 + i * 0.07, duration: 0.6, ease: EASE } },
                }}
              />
            ))}
            <motion.span
              className="block"
              style={{ originY: 1 }}
              variants={{
                hidden: { scaleY: 0 },
                show: { scaleY: 1, transition: { delay: 0.55, duration: 0.6, ease: EASE } },
              }}
            >
              <span className="affiliate-art-bar relative block w-6 rounded-[5px] bg-[linear-gradient(180deg,#5b7cff_0%,#335cff_100%)] shadow-[0_6px_14px_-6px_rgba(51,92,255,0.8)]">
                <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2">
                  <span className={cn(TAG_CLASS, "affiliate-art-commission h-[18px] whitespace-nowrap rounded-md px-1.5 text-[9.5px]")}>
                    +$29.70
                  </span>
                </span>
              </span>
            </motion.span>
          </div>
        </Surface>
      </motion.div>
    </ArtStage>
  );
}
