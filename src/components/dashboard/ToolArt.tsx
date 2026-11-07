"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUp, Check, Flame, Link, Play, RectangleVertical, Timer, Wand2 } from "lucide-react";
import { Short, Stage, rise } from "@/components/illustration/stage";
import { cn } from "@/lib/utils";

/* Coded preview art for the dashboard tool cards: a few large elements per
 * card, specific to the tool, on a flat #EFEFEF ground. Flat white surfaces
 * (a hairline edge, no drop shadows or glows), real short-form clips, brand
 * blue only on the thing the tool produces, and one quiet
 * loop per card that shows the tool working (tool-art-* in globals.css,
 * paused off screen by the Stage's .anim-gate). Drawn at a fixed 400 × 225
 * (the card's 16:9 slot) and scaled to fit; dark variants follow `.dark`. */

const W = 400;
const H = 225;

const SURFACE =
  "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-zinc-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]";
const TILE =
  "overflow-hidden rounded-[14px] bg-zinc-200 ring-[3px] ring-white dark:bg-zinc-800 dark:ring-zinc-700";
const INK = "text-zinc-900 dark:text-zinc-50";
const MUTED = "text-zinc-500 dark:text-zinc-400";
const BLUE_BUTTON =
  "bg-[linear-gradient(180deg,#4a6fff_0%,#335cff_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]";

/** Sets a CSS custom property inline (animation delays, row pitch). */
function vars(v: Record<string, string | number>): CSSProperties {
  return v as CSSProperties;
}

function ToolStage({ children }: { children: ReactNode }) {
  return (
    <Stage width={W} height={H} background={<div className="absolute inset-0 bg-[#EFEFEF] dark:bg-[#1c1c1f]" />}>
      {children}
    </Stage>
  );
}

function Surface({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("relative rounded-2xl", SURFACE, className)}>{children}</div>;
}

/** A surface placed on the canvas, rising in on entrance. */
function Panel({
  left,
  top,
  width,
  height,
  delay = 0,
  className,
  children,
}: {
  left: number;
  top: number;
  width: number;
  height?: number;
  delay?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <motion.div variants={rise(delay, 8)} className="absolute" style={{ left, top, width, height }}>
      <Surface className={cn("h-full", className)}>{children}</Surface>
    </motion.div>
  );
}

function Caret() {
  return <span className="tool-art-caret ml-0.5 inline-block h-[13px] w-[1.5px] translate-y-[2px] bg-[#335cff]" />;
}

/** A thin playback bar along a clip's foot. */
function ClipProgress({ className = "tool-art-progress" }: { className?: string }) {
  return (
    <>
      <span className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/45 to-transparent" />
      <span className="absolute inset-x-2.5 bottom-2.5 h-[3px] overflow-hidden rounded-full bg-white/30">
        <span className={cn("block h-full origin-left rounded-full bg-white", className)} />
      </span>
    </>
  );
}

function Avatar({ src, size }: { src: string; size: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full ring-1 ring-black/5" style={{ width: size, height: size }}>
      <Image src={src} alt="" fill sizes={`${size * 2}px`} className="object-cover object-top" />
    </span>
  );
}

/** A white-framed short-form clip, flat on the ground (no glow or shadow). */
function Clip({
  poster,
  video,
  left,
  top,
  width,
  height,
  delay = 0,
  children,
}: {
  poster: string;
  video?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  delay?: number;
  children?: ReactNode;
}) {
  return (
    <motion.div variants={rise(delay, 10)} className={cn("absolute", TILE)} style={{ left, top, width, height }}>
      <Short poster={poster} video={video} sizes="220px" />
      {children}
    </motion.div>
  );
}

/* ─── Niche Bending ───────────────────────────────────────────────────── */

// One proven format branching into new, non-competing niches.
const NICHES = [
  { src: "/videos/babe-ruth-poster.jpg", name: "Sports Stars", match: 94, cy: 51 },
  { src: "/videos/misc-poster.jpg", name: "True Crime", match: 88, cy: 113 },
  { src: "/videos/school-college-poster.jpg", name: "School Life", match: 81, cy: 175 },
];

export function NicheBendingArt() {
  return (
    <ToolStage>
      <motion.svg variants={rise(0.3, 0)} className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        {NICHES.map((n) => (
          <path
            key={n.name}
            d={`M156 113 C 192 113, 182 ${n.cy}, 218 ${n.cy}`}
            className="tool-art-dash"
            stroke="#335cff"
            strokeOpacity={n.match > 90 ? 0.7 : 0.3}
            strokeWidth={1.5}
            strokeDasharray="4 5"
            strokeLinecap="round"
          />
        ))}
        <path d="M128 113 H156" stroke="#335cff" strokeOpacity={0.5} strokeWidth={1.5} />
      </motion.svg>

      <Clip poster="/videos/einstein-poster.jpg" left={36} top={28} width={96} height={170}>
        <span className="absolute bottom-2 left-2 inline-flex h-[22px] items-center whitespace-nowrap rounded-md bg-white/95 px-2 text-[10.5px] font-semibold text-zinc-800">
          History Facts
        </span>
      </Clip>

      <motion.span
        variants={rise(0.35, 0)}
        className={cn("absolute grid h-8 w-8 place-items-center rounded-full ring-4 ring-[#EFEFEF] dark:ring-[#1c1c1f]", BLUE_BUTTON)}
        style={{ left: 140, top: 97 }}
      >
        <Wand2 className="h-4 w-4" strokeWidth={2.25} />
      </motion.span>

      {NICHES.map((n, i) => {
        const picked = i === 0;
        return (
          <motion.div key={n.name} variants={rise(0.45 + i * 0.12, 6)} className="absolute" style={{ left: 218, top: n.cy - 21, width: 162, height: 42 }}>
            <Surface className={cn("flex h-full items-center gap-2 rounded-[12px] pl-1.5 pr-2.5", picked && "ring-[1.5px] ring-[#335cff]/60")}>
              <Avatar src={n.src} size={28} />
              <span className={cn("min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[-0.01em]", INK)}>{n.name}</span>
              <span className={cn("text-[10.5px] font-semibold tabular-nums", picked ? "text-[#335cff]" : MUTED)}>{n.match}%</span>
            </Surface>
          </motion.div>
        );
      })}
    </ToolStage>
  );
}

/* ─── Clipping ────────────────────────────────────────────────────────── */

// A real long video ("Escape 100 Cops, Win $500,000", 20:28) turned into
// Shorts, in three 2.6s beats (a 7.8s loop, tool-art-clip-* in globals.css).
// Each beat the playhead jumps to a viral moment (its marker lifts), the 9:16
// crop locks on, a beam carries it across, and its Short lands on top of the
// stack as the older ones step back. Each Short is a ~2s cut of that moment,
// the exact 9:16 window of the frame, captioned with what is said there.
// With reduced motion it rests on the first moment.
const CLIP_ART = "/tools/art/clipping";
const CLIP_BEAT = 2.6;
const SOURCE_LENGTH = 1228; // seconds
const PLAYER = { left: 14, top: 46, width: 236, height: 133 };
const CROP_W = 75; // 9:16 of the player's height, centred like the cuts
const CROP_LEFT = (PLAYER.width - CROP_W) / 2;
const PLAYER_TILE = "absolute overflow-hidden rounded-[14px] bg-black ring-[3px] ring-white dark:ring-zinc-700";
const SHORT = { left: 272, top: 32, width: 100, height: 178 };
// `at` must match the seeks in tool-art-clip-played.
const MOMENTS = [
  { at: 22, lead: "Let's", word: "Blow it up!", score: 97 },
  { at: 394, lead: "We gotta", word: "Go!", score: 91 },
  { at: 1172, lead: "They won", word: "$500,000!", score: 94 },
];
// Where each card sits at rest (beat one): newest in front, then back.
const STACK_REST = [
  { transform: "none", zIndex: 3 },
  { transform: "translate(18px, -18px) scale(0.86)", zIndex: 1 },
  { transform: "translate(9px, -9px) scale(0.93)", zIndex: 2 },
];

/** Negative delay that lines a 7.8s animation up with this moment's beat. */
function clipBeat(i: number) {
  const loop = CLIP_BEAT * MOMENTS.length;
  return `${-((loop - i * CLIP_BEAT) % loop)}s`;
}

function clockTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const CAPTION = "font-black uppercase leading-none tracking-[-0.01em] text-white";

export function ClippingArt() {
  const beam = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-beam`;
  const cropRight = PLAYER.left + CROP_LEFT + CROP_W;
  return (
    <ToolStage>
      {/* the long video, with the 9:16 crop dimming everything around it */}
      <motion.div variants={rise(0, 8)} className={PLAYER_TILE} style={PLAYER}>
        {MOMENTS.map((m, i) => (
          <span
            key={m.at}
            className="tool-art-clip-scene absolute inset-0"
            style={{ animationDelay: clipBeat(i), opacity: i === 0 ? 1 : 0 }}
          >
            <Image src={`${CLIP_ART}/cops-wide-${i + 1}.webp`} alt="" fill sizes="480px" className="object-cover" />
          </span>
        ))}
        <span
          className="absolute inset-y-0 rounded-[6px] shadow-[0_0_0_400px_rgba(0,0,0,0.6)]"
          style={{ left: CROP_LEFT, width: CROP_W }}
        >
          <span className="tool-art-clip-lock absolute inset-0 rounded-[6px] border-2 border-[#335cff]" />
          <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-[4px] bg-[#335cff] px-1 py-[2px] text-[8px] font-bold leading-none text-white">
            9:16
          </span>
        </span>
        <span className="absolute left-1.5 top-1.5 inline-flex h-4 items-center gap-1 rounded-[5px] bg-black/60 pl-1 pr-1.5 text-[9px] font-semibold tabular-nums text-white">
          <Image src="/logos/social/youtube.png" alt="" width={10} height={10} className="h-2.5 w-2.5" />
          {clockTime(SOURCE_LENGTH)}
        </span>
        {/* the timeline: playback in YouTube red, the viral moments in blue */}
        <span className="absolute inset-x-2 bottom-2 h-[3px] rounded-full bg-white/25">
          <span className="tool-art-clip-played absolute inset-y-0 left-0 rounded-full bg-[#ff0033]">
            <span className="absolute -right-[3.5px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-[#ff0033]" />
          </span>
          {MOMENTS.map((m, i) => (
            <span
              key={m.at}
              className="tool-art-clip-mark absolute inset-y-0 w-[4%] rounded-full bg-[#5b7cff]"
              style={{ left: `${(100 * m.at) / SOURCE_LENGTH}%`, animationDelay: clipBeat(i) }}
            />
          ))}
        </span>
      </motion.div>

      {/* the crop, carried across to the Short it becomes */}
      <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        <defs>
          <linearGradient id={beam}>
            <stop offset="0" stopColor="#335cff" stopOpacity={0.24} />
            <stop offset="1" stopColor="#335cff" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <path
          d={`M${cropRight} ${PLAYER.top} L${SHORT.left - 3} ${SHORT.top - 3} L${SHORT.left - 3} ${SHORT.top + SHORT.height + 3} L${cropRight} ${PLAYER.top + PLAYER.height} Z`}
          fill={`url(#${beam})`}
          className="tool-art-clip-beam"
        />
      </svg>

      {/* the Shorts, newest on top, each playing its cut */}
      <motion.div variants={rise(0.2, 8)} className="absolute" style={SHORT}>
        {MOMENTS.map((m, i) => (
          <div
            key={m.at}
            className={cn("tool-art-clip-card absolute inset-0 origin-top-right", TILE)}
            style={{ animationDelay: clipBeat(i), ...STACK_REST[i] }}
          >
            <Short poster={`${CLIP_ART}/cops-short-${i + 1}.webp`} video={`${CLIP_ART}/cops-short-${i + 1}.mp4`} sizes="280px" />
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
            <span className="absolute inset-x-0 bottom-[22%] flex flex-col items-center gap-[3px]">
              <span className={cn(CAPTION, "text-[9.5px] [text-shadow:0_1px_0_rgba(0,0,0,0.85),0_0_4px_rgba(0,0,0,0.6)]")}>{m.lead}</span>
              <span className={cn(CAPTION, "whitespace-nowrap rounded-[4px] bg-[#335cff] px-1 py-[3px] text-[11px]")}>{m.word}</span>
            </span>
            {/* bottom-left: covered on the cards stacked behind */}
            <span className="absolute bottom-1.5 left-1.5 inline-flex h-4 items-center gap-[2px] rounded-full bg-white/95 pl-1 pr-1.5 text-[9.5px] font-bold tabular-nums leading-none text-zinc-800">
              <Flame className="h-2.5 w-2.5 fill-[#335cff] text-[#335cff]" strokeWidth={2} />
              {m.score}
            </span>
          </div>
        ))}
      </motion.div>
    </ToolStage>
  );
}

/* ─── Image Generator ─────────────────────────────────────────────────── */

// Four 77px columns under the prompt bar, the picked one taller and raised.
const ROW_LEFT = 34;
const STEP = 85;
const TILE_W = 77;
const GENERATED = ["/text2img-thumb-1.png", "/text2img-thumb-2.png", "/text2img-thumb-3.png", "/text2img-thumb-4.png"];

export function ImageGeneratorArt() {
  return (
    <ToolStage>
      <motion.div variants={rise(0, 6)} className="absolute" style={{ left: ROW_LEFT, top: 24, width: 332 }}>
        <Surface className="flex h-11 items-center justify-between gap-2.5 rounded-[14px] pl-4 pr-1.5">
          <span className={cn("text-[12.5px] font-medium tracking-[-0.005em]", INK)}>
            a tabby cat in warm afternoon light
            <Caret />
          </span>
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[10px]", BLUE_BUTTON)}>
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </Surface>
      </motion.div>

      {GENERATED.map((src, i) => {
        const left = ROW_LEFT + i * STEP;
        const delay = 0.3 + i * 0.1;
        return i === 1 ? (
          <Clip key={src} poster={src} left={left} top={80} width={TILE_W} height={110} delay={delay}>
            <span className="absolute right-1.5 top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#335cff] ring-2 ring-white">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
            </span>
          </Clip>
        ) : (
          <motion.div key={src} variants={rise(delay, 8)} className={cn("absolute", TILE)} style={{ left, top: 88, width: TILE_W, height: 100 }}>
            <Image src={src} alt="" fill sizes="110px" className="object-cover" />
          </motion.div>
        );
      })}
    </ToolStage>
  );
}

/* ─── Video Generator ─────────────────────────────────────────────────── */

// A prompt box with its model, length and ratio, and the clip it produced,
// playing as Ready. The send button's press is the card's one quiet loop
// (tool-art-vg-press in globals.css).
const VG_OPTION = "inline-flex h-6 items-center gap-1 rounded-md bg-zinc-100 px-1.5 text-[10.5px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300";

export function VideoGeneratorArt() {
  return (
    <ToolStage>
      <Panel left={16} top={52} width={238} height={121} className="flex flex-col p-3.5">
        <p className={cn("text-[12.5px] font-medium leading-[1.45] tracking-[-0.01em]", INK)}>
          A boy under a flickering hallway light, Pixar style
          <Caret />
        </p>
        <div className="mt-auto flex items-center gap-1">
          <span className={VG_OPTION}>
            <Image src="/logos/ai/kling.svg" alt="" width={11} height={11} className="h-[11px] w-[11px]" />
            Kling 4.0
          </span>
          <span className={VG_OPTION}>
            <Timer className="h-[11px] w-[11px]" strokeWidth={2.25} />
            5s
          </span>
          <span className={VG_OPTION}>
            <RectangleVertical className="h-[11px] w-[11px]" strokeWidth={2.25} />
            9:16
          </span>
          <span className={cn("tool-art-vg-press ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-[9px]", BLUE_BUTTON)}>
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        </div>
      </Panel>

      <Clip
        poster="/videos/video-generator-showcase-poster.jpg"
        video="/videos/video-generator-showcase.mp4"
        left={270}
        top={13}
        width={112}
        height={199}
        delay={0.2}
      >
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-[3px] text-[9.5px] font-semibold leading-none text-white backdrop-blur-sm">
          <Check className="h-2.5 w-2.5 text-emerald-300" strokeWidth={3.5} />
          Ready
        </span>
        <ClipProgress />
      </Clip>
    </ToolStage>
  );
}

/* ─── Scriptwriter ────────────────────────────────────────────────────── */

/** A hand-drawn line: points every 10px with a gentle deterministic wobble,
 * smoothed through their midpoints (stable across server and client). */
function wobble(x1: number, x2: number, y: number, seed: number, amp = 1) {
  const pts: [number, number][] = [];
  for (let i = 0, x = x1; x < x2 + 10; i++, x += 10) {
    const dy = (Math.sin(i * 1.9 + seed) * 1.7 + Math.sin(i * 0.7 + seed * 2) * 1.3) * amp;
    pts.push([Math.min(x, x2), y + dy]);
  }
  let d = `M${pts[0][0]} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    d += ` Q${px} ${py.toFixed(1)} ${((px + cx) / 2).toFixed(1)} ${((py + cy) / 2).toFixed(1)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx} ${ly.toFixed(1)}`;
}

// The script's lines, written in turn after the button is pressed. The pen's
// tip is a short soft blue blur (the `-soft` stroke, one dash riding the
// line's head) with the crisp ink following inside it; when the line is done
// the tip melts away, leaving it clear, and the next line starts.
const SCRIPT_LINES = [
  { d: wobble(78, 196, 34, 1), step: "tool-script-1" },
  { d: wobble(78, 322, 60, 4), step: "tool-script-2" },
  { d: wobble(78, 304, 84, 7), step: "tool-script-3" },
  { d: wobble(78, 236, 108, 2), step: "tool-script-4" },
];

export function ScriptwriterArt() {
  const blur = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-soft`;
  return (
    <ToolStage>
      <motion.svg variants={rise(0, 6)} className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        <defs>
          <filter id={blur} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {SCRIPT_LINES.map((line) => (
          <g key={line.step}>
            <path
              d={line.d}
              pathLength={1}
              className={line.step}
              stroke="#a1a1aa"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={line.d}
              pathLength={1}
              className={`${line.step}-soft`}
              stroke="#8fb2ff"
              strokeWidth={8}
              // butt caps: a round cap on the not-yet-drawn dash shows as a dot
              strokeLinecap="butt"
              strokeLinejoin="round"
              filter={`url(#${blur})`}
            />
          </g>
        ))}
      </motion.svg>

      <motion.div variants={rise(0.15, 8)} className="absolute" style={{ left: 66, top: 140, width: 268 }}>
        <Surface className="flex h-[50px] items-center justify-between rounded-[16px] pl-5 pr-[7px]">
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-zinc-700 dark:text-zinc-200">Generate Script</span>
          <span className="tool-script-press grid h-9 w-9 place-items-center rounded-[10px] bg-[linear-gradient(180deg,#6b9bff_0%,#3a6bff_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
        </Surface>
      </motion.div>
    </ToolStage>
  );
}

/* ─── Transcript Extractor ────────────────────────────────────────────── */

// The clip wired to its transcript, one timestamped segment per beat: the
// segment's old lines clear, a pulse runs down its wire, its card lights, and
// its lines are written with the Scriptwriter's soft pen tip. Each card is
// only ever cleared just before it's rewritten, so the loop is seamless and
// never empties. One 8s clock drives it all (--tx-t, tool-art-tx-* in
// globals.css), so each piece only carries its times in seconds (--clear,
// --at, --for); the pulses are keyframes on the same loop. With reduced
// motion the clock rests on a finished frame: every line written, the last
// card lit. The clip is three cuts of one short ("24 Hours As Miles
// Morales!": the intro, the sign flip, the crowd), 8s like the loop.
const TX_LOOP = 8; // seconds, matches tool-art-tx-clock and tool-art-tx-pulse
const TX_BEAT = TX_LOOP / 3;
const TX_PEN = 200; // px per second, so longer lines take longer to write
const TX_FROM = 141; // the clip's right edge, outside its ring
const TX_CARD = { left: 200, width: 166, height: 58 };
// `from`: where the segment's wire leaves the clip
const SEGMENTS = [
  { t: "00:00", cy: 47, from: 83, lines: [134, 92] },
  { t: "00:03", cy: 113, from: 113, lines: [140, 116] },
  { t: "00:07", cy: 179, from: 143, lines: [126, 78] },
];

/** The dashed elbow from the clip into a card's left edge. */
function txLink({ cy, from }: (typeof SEGMENTS)[number]) {
  if (cy === from) return `M${TX_FROM} ${cy} H${TX_CARD.left}`;
  const bend = 168;
  const r = 8 * Math.sign(cy - from);
  return `M${TX_FROM} ${from} H${bend - 8} Q${bend} ${from} ${bend} ${from + r} V${cy - r} Q${bend} ${cy} ${bend + 8} ${cy} H${TX_CARD.left}`;
}

const secs = (n: number) => n.toFixed(3);

/** When segment `i` plays: cleared, its pulse, its card lit, then each line
 * in turn (all inside the loop, as the clock wraps to 0). */
function txBeat(i: number) {
  const start = 0.3 + i * TX_BEAT;
  let at = start + 0.55;
  const lines = SEGMENTS[i].lines.map((len, j) => {
    const line = { len, at, for: len / TX_PEN, d: wobble(1.5, len - 1.5, 10, i * 3 + j * 5 + 1, 0.7) };
    at += line.for + 0.08;
    return line;
  });
  return { clear: secs(start), pulse: `${start - TX_LOOP}s`, lit: secs(start + 0.35), lines };
}

const TX_BEATS = SEGMENTS.map((_, i) => txBeat(i));

/** One line of a card, written left to right with the soft tip at its head. */
function TxLine({ line, top }: { line: (typeof TX_BEATS)[number]["lines"][number]; top: number }) {
  return (
    <span
      className="absolute overflow-hidden"
      style={{
        left: 4,
        top,
        width: line.len + 16,
        height: 20,
        ...vars({ "--at": secs(line.at), "--for": secs(line.for), "--len": `${line.len}px` }),
      }}
    >
      <svg className="tool-art-tx-write absolute left-2 top-0" width={line.len} height={20} viewBox={`0 0 ${line.len} 20`} fill="none">
        <path d={line.d} className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        className="tool-art-tx-tip absolute top-[6.5px] h-[7px] w-[30px] rounded-full bg-[linear-gradient(90deg,rgba(143,178,255,0),#8fb2ff)] blur-[2.5px]"
        style={{ left: -22 }}
      />
    </span>
  );
}

export function TranscriptArt() {
  const glow = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-pulse`;
  return (
    <ToolStage>
      <div className="tool-art-tx-clock absolute inset-0">
        <motion.svg variants={rise(0.3, 0)} className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
          <defs>
            <filter id={glow} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          {/* the wires first, so a lit one is never painted over */}
          {SEGMENTS.map((seg) => (
            <path key={seg.t} d={txLink(seg)} className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth={1.5} strokeDasharray="4 5" strokeLinecap="round" />
          ))}
          {SEGMENTS.map((seg, i) => {
            const d = txLink(seg);
            const { pulse, lit } = TX_BEATS[i];
            return (
              <g key={seg.t} style={vars({ "--at": lit })}>
                <path d={d} className="tool-art-tx-on" stroke="#335cff" strokeWidth={1.5} strokeDasharray="4 5" strokeLinecap="round" />
                {/* the pulse: a crisp head inside a soft glow */}
                <path d={d} pathLength={1} className="tool-art-tx-pulse" style={{ animationDelay: pulse }} stroke="#8fb2ff" strokeWidth={6} filter={`url(#${glow})`} />
                <path d={d} pathLength={1} className="tool-art-tx-pulse" style={{ animationDelay: pulse }} stroke="#335cff" strokeWidth={2} />
              </g>
            );
          })}
        </motion.svg>

        <Clip poster="/tools/art/transcript/miles.webp" video="/tools/art/transcript/miles.mp4" left={32} top={18.5} width={106} height={188} delay={0.1}>
          <ClipProgress className="tool-art-tx-progress" />
        </Clip>

        {SEGMENTS.map((seg, i) => (
          <motion.div
            key={seg.t}
            variants={rise(0.2 + i * 0.1, 6)}
            className="absolute"
            style={{ left: TX_CARD.left, top: seg.cy - TX_CARD.height / 2, width: TX_CARD.width, height: TX_CARD.height }}
          >
            <div className="h-full" style={vars({ "--clear": TX_BEATS[i].clear, "--at": TX_BEATS[i].lit })}>
              <Surface className="h-full rounded-[14px]">
                <span className="tool-art-tx-on absolute inset-0 rounded-[14px] ring-[1.5px] ring-[#335cff]/60" />
                <span className="absolute left-3 top-2.5 text-[13px] font-semibold leading-none tabular-nums tracking-[-0.01em]">
                  <span className={cn("tool-art-tx-off", INK)}>{seg.t}</span>
                  <span className="tool-art-tx-on absolute inset-0 text-[#335cff] dark:text-[#6d8dff]">{seg.t}</span>
                </span>
                <span className="tool-art-tx-ink absolute inset-0">
                  {TX_BEATS[i].lines.map((line, j) => (
                    <TxLine key={j} line={line} top={24 + j * 12} />
                  ))}
                </span>
              </Surface>
            </div>
          </motion.div>
        ))}
      </div>
    </ToolStage>
  );
}

/* ─── Downloader ──────────────────────────────────────────────────────── */

// The platform grid and the downloader card, set in motion: one platform at a
// time lights its link badge, lands in the downloader, the hand taps Download,
// the button fills, and the link badge turns into a check. Five 2.4s beats
// make one 12s loop (tool-art-dl-* in globals.css); with reduced motion it
// rests on YouTube. Tiles and hand are cut from the original still.
const DL = "/tools/art/downloader";
const BEAT = 2.4;
const CYCLE = ["youtube", "tiktok", "instagram", "facebook", "snapchat"];
const LOOP = BEAT * CYCLE.length;
const GRID = [
  { name: "tiktok", left: 48, top: 52, badge: { left: 40, top: -3 } },
  { name: "instagram", left: 112, top: 52, badge: { left: 41.5, top: -3.5 } },
  { name: "facebook", left: 48, top: 117, badge: { left: 40, top: -3.5 } },
  { name: "snapchat", left: 112, top: 117, badge: { left: 44, top: -6 } },
];

/** Negative delay that lines a 12s animation's window up with this platform's beat. */
function beatDelay(name: string) {
  return `${-((LOOP - CYCLE.indexOf(name) * BEAT) % LOOP)}s`;
}

function LinkBadge({ left, top, pickDelay }: { left: number; top: number; pickDelay?: string }) {
  return (
    <span className="absolute h-[18.5px] w-[18.5px]" style={{ left, top }}>
      <span className="absolute inset-0 grid place-items-center rounded-[5px] border border-[#e2e2e2] bg-white dark:border-zinc-600 dark:bg-zinc-700">
        <Link className="h-[11px] w-[11px] text-[#9d9d9d]" strokeWidth={2.75} />
      </span>
      {pickDelay && (
        <span
          className="tool-art-dl-pick-badge absolute inset-0 grid place-items-center rounded-[5px] bg-[#335cff]"
          style={{ animationDelay: pickDelay }}
        >
          <Link className="h-[11px] w-[11px] text-white" strokeWidth={2.75} />
        </span>
      )}
    </span>
  );
}

// The tiles were cut from a light still, so their edges carry a white fringe and
// the badge corner is squared off. On dark that reads as a halo, so there each
// tile is scaled a touch past a clean rounded clip.
function PlatformTile({ name, sizes, radius }: { name: string; sizes: string; radius: string }) {
  return (
    <span className={cn("absolute inset-0 dark:overflow-hidden", radius)}>
      <Image src={`${DL}/${name}.png`} alt="" fill sizes={sizes} className="object-contain dark:scale-[1.06] dark:object-cover" />
    </span>
  );
}

const DL_CARD = "absolute rounded-[18px] border border-[#dedede] bg-white dark:border-zinc-700 dark:bg-zinc-800";

export function DownloaderArt() {
  return (
    <ToolStage>
      <motion.div variants={rise(0, 8)} className={DL_CARD} style={{ left: 35, top: 38, width: 148, height: 148 }} />
      {GRID.map((t, i) => (
        <motion.div key={t.name} variants={rise(0.1 + i * 0.06, 6)} className="absolute" style={{ left: t.left, top: t.top, width: 57, height: 57 }}>
          <span className="tool-art-dl-pick absolute inset-0" style={{ animationDelay: beatDelay(t.name) }}>
            <PlatformTile name={t.name} sizes="160px" radius="dark:rounded-[9px]" />
            <LinkBadge left={t.badge.left} top={t.badge.top} pickDelay={beatDelay(t.name)} />
          </span>
        </motion.div>
      ))}

      <motion.div variants={rise(0.15, 8)} className={DL_CARD} style={{ left: 216, top: 38, width: 149, height: 148 }} />
      <motion.div variants={rise(0.3, 6)} className="absolute" style={{ left: 260, top: 68, width: 62, height: 59.5 }}>
        {CYCLE.map((name, i) => (
          <span
            key={name}
            className="tool-art-dl-tile absolute inset-0"
            style={{ animationDelay: beatDelay(name), opacity: i === 0 ? 1 : 0 }}
          >
            <PlatformTile name={name} sizes="170px" radius="dark:rounded-[10px]" />
          </span>
        ))}
        {/* the downloader's own badge: link while it fetches, check once saved */}
        <span className="tool-art-dl-linkout absolute" style={{ left: 50, top: -8.5 }}>
          <LinkBadge left={0} top={0} />
        </span>
        <span
          className="tool-art-dl-check absolute grid h-[18.5px] w-[18.5px] place-items-center rounded-[5px] bg-[#335cff]"
          style={{ left: 50, top: -8.5 }}
        >
          <Check className="h-[11px] w-[11px] text-white" strokeWidth={3.5} />
        </span>
      </motion.div>

      <motion.div variants={rise(0.4, 6)} className="absolute" style={{ left: 229, top: 143.5, width: 124, height: 30.5 }}>
        <span className="tool-art-dl-press relative grid h-full w-full place-items-center overflow-hidden rounded-[8px] bg-[#1e5cfd] text-[18px] font-bold tracking-[-0.01em] text-white">
          <span className="tool-art-dl-fill absolute inset-0 origin-left bg-white/25" />
          <span className="relative">Download</span>
        </span>
      </motion.div>

      {/* the tap: ripple under the fingertip, then the hand itself */}
      <span className="tool-art-dl-ripple absolute h-6 w-6 rounded-full border-2 border-[#335cff]" style={{ left: 321, top: 152 }} />
      <motion.div variants={rise(0.55, 8)} className="absolute" style={{ left: 331, top: 160.5, width: 48.5, height: 40.5 }}>
        <span className="tool-art-dl-hand absolute inset-0 origin-[4px_3px]">
          <Image src={`${DL}/hand.png`} alt="" fill sizes="140px" className="object-contain" />
        </span>
      </motion.div>
    </ToolStage>
  );
}

/* ─── Niche Finder ────────────────────────────────────────────────────── */

// The landing page's niche-search art (transparent, 16:9) on the shared ground.
export function NicheFinderArt() {
  return (
    <ToolStage>
      <motion.div variants={rise(0, 10)} className="absolute inset-0">
        <Image src="/tools/light/niche-finder.webp" alt="" fill sizes="(min-width: 1024px) 440px, 100vw" className="object-contain" />
      </motion.div>
    </ToolStage>
  );
}

/* ─── Voiceover ───────────────────────────────────────────────────────── */

const WORDS = ["One", "hit", "away", "from", "victory."];
const SPEECH = 6; // seconds for the whole line, playhead and words in step
const WAVE = Array.from({ length: 28 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.58) * Math.cos(i * 0.21)));

function Bars({ className }: { className: string }) {
  return (
    <span className="flex h-11 w-[120px] shrink-0 items-center gap-[2px]">
      {WAVE.map((h, i) => (
        <span
          key={i}
          className={cn("tool-art-wave block flex-1 rounded-full", className)}
          style={{ height: `${Math.round(h * 100)}%`, animationDelay: `${-((i * 0.13) % 1.1).toFixed(2)}s` }}
        />
      ))}
    </span>
  );
}

export function VoiceoverArt() {
  return (
    <ToolStage>
      <Panel left={30} top={28} width={340} height={50} className="flex items-center rounded-[14px] px-4">
        <span className={cn("flex items-center gap-[5px] text-[13px] font-medium tracking-[-0.005em]", INK)}>
          {WORDS.map((w, i) => (
            <span
              key={w}
              className="tool-art-word rounded-[4px] px-[3px]"
              style={vars({ animationDelay: `${-(SPEECH - (i * SPEECH) / WORDS.length)}s` })}
            >
              {w}
            </span>
          ))}
        </span>
      </Panel>

      <Panel left={30} top={92} width={340} height={104} delay={0.2} className="flex items-center gap-3 px-4">
        <span className="relative h-14 w-14 shrink-0">
          <span className="absolute inset-0 overflow-hidden rounded-full ring-[3px] ring-white dark:ring-zinc-700">
            <Image src="/tools/art/voice-maya.jpg" alt="" fill sizes="112px" className="object-cover object-top" />
          </span>
        </span>
        <span className="w-12 shrink-0 leading-tight">
          <span className={cn("block text-[13px] font-semibold", INK)}>Maya</span>
          <span className={cn("mt-0.5 block text-[11px]", MUTED)}>Warm</span>
        </span>
        {/* the waveform, with the played part filling under a moving playhead */}
        <span className="relative">
          <Bars className="bg-zinc-200 dark:bg-zinc-600" />
          <span className="tool-art-played absolute inset-y-0 left-0 overflow-hidden">
            <Bars className="bg-[#335cff]" />
          </span>
        </span>
        <span className={cn("ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full", BLUE_BUTTON)}>
          <Play className="ml-0.5 h-4 w-4 fill-white" strokeWidth={0} />
        </span>
      </Panel>
    </ToolStage>
  );
}
