"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Check, CircleDot, Eye, Heart, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gates a card's motion loop to when it actually scrolls into view, instead
 * of firing (and burning cycles) at mount while it's still off-screen. */
function useInView<T extends Element>(threshold = 0.4) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold]);

  return { ref, inView } as const;
}

const DOT_PATTERN = {
  backgroundImage: "radial-gradient(#ffffff33 1px, transparent 1px)",
  backgroundSize: "12px 12px",
};

function SoundWave({ flip = false }: { flip?: boolean }) {
  const line = <span className="h-px flex-1 bg-slate-300" />;
  const bars = (
    <span className="flex shrink-0 items-end gap-0.5">
      <span className="h-1.5 w-0.5 rounded-full bg-slate-300" />
      <span className="h-2.5 w-0.5 rounded-full bg-slate-300" />
      <span className="h-1.5 w-0.5 rounded-full bg-slate-300" />
    </span>
  );
  return (
    <span aria-hidden className="flex flex-1 items-center gap-2">
      {flip ? (
        <>
          {bars}
          {line}
        </>
      ) : (
        <>
          {line}
          {bars}
        </>
      )}
    </span>
  );
}

function CardShell({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2.5rem] bg-slate-50 p-2.5 shadow-sm">
      <div className="relative flex h-[500px] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div aria-hidden className="absolute inset-x-0 top-0 z-0 h-[65%] bg-gradient-to-b from-blue-500 to-white">
          <div aria-hidden className="absolute inset-0" style={DOT_PATTERN} />
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-8 pb-4 pt-10">{children}</div>

        <div className="relative z-10 flex items-center gap-3 px-8 pb-6">
          <SoundWave />
          <span className="shrink-0 rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-blue-500/40">
            Step {step}
          </span>
          <SoundWave flip />
        </div>

        <div className="relative z-10 px-6 pb-8">
          <h3 className="text-center text-xl font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-center text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

const GLASS_RIM_SHADOW =
  "inset 0 1px 1px rgba(255,255,255,0.6), inset 1px 0 0 rgba(255,255,255,0.18), inset -1px 0 0 rgba(255,255,255,0.1)";

const FADE_MASK = "linear-gradient(to bottom, black 55%, transparent 100%)";

function VideoThumb({
  src,
  views,
  active,
  delay,
  position,
  tilt,
  badgeLeft,
}: {
  src: string;
  views: string;
  active: boolean;
  delay: number;
  position: string;
  tilt: string;
  badgeLeft: string;
}) {
  return (
    <div
      className={cn("absolute", position, active && "animate-float-soft")}
      style={active ? { animationDelay: `${delay}s` } : undefined}
    >
      <div className={cn("relative w-40", tilt)}>
        <div
          className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/40"
          style={{
            boxShadow: GLASS_RIM_SHADOW,
            WebkitMaskImage: FADE_MASK,
            maskImage: FADE_MASK,
          }}
        >
          <Image src={src} alt="" fill sizes="160px" className="object-cover" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/45 to-transparent"
          />
        </div>
        {/* left offset counteracts the card's tilt so the badge still lands dead-center over the tilted top edge */}
        <span
          className={cn(
            "absolute top-2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/30 bg-black/45 px-3.5 py-2 text-sm font-semibold leading-none text-white shadow-sm backdrop-blur-xl",
            badgeLeft,
          )}
        >
          <Eye className="h-4 w-4" />
          {views}
        </span>
      </div>
    </div>
  );
}

function HookMockup({ active }: { active: boolean }) {
  return (
    <div className="relative h-[260px] w-full" aria-hidden>
      <VideoThumb
        src="/hook-thumb-1.png"
        views="2.1M"
        active={active}
        delay={0}
        position="left-[-4%] top-[6px] z-10"
        tilt="-rotate-[6deg]"
        badgeLeft="left-[55%]"
      />
      <VideoThumb
        src="/hook-thumb-2.png"
        views="2.6M"
        active={active}
        delay={1.6}
        position="left-[42%] top-[42px] z-20"
        tilt="rotate-[5deg]"
        badgeLeft="left-[46%]"
      />
    </div>
  );
}

/** Each line of the mockup "script": the real, concrete sentence it starts
 * as, and the `{placeholder}` template it resolves into once the AI reads
 * it — this before/after is the whole point of the animation, so the copy
 * mirrors an actual viral-script breakdown rather than generic filler. */
const FORMULA_LINES = [
  {
    before: "From private jets to broke.",
    after: "From {something} to {something}.",
    label: "Hook",
    tint: "blue",
  },
  {
    before: "This is every US president's wealth, explained.",
    after: "This is every {topic}, explained.",
    label: undefined,
    tint: undefined,
  },
  {
    before: "But first, the broke club.",
    after: "But first, meet the {group name}.",
    label: "Pattern",
    tint: "purple",
  },
  {
    before: "Except Buchanan, dead broke.",
    after: "Except {name} — {trait} ever.",
    label: "Fact",
    tint: "emerald",
  },
] as const;

const LINE_STAGGER = 0.85;

const TAG_STYLES = {
  blue: { pill: "border-blue-200 bg-blue-50 text-blue-600", text: "text-blue-600/90", dot: "bg-blue-500" },
  purple: { pill: "border-purple-200 bg-purple-50 text-purple-600", text: "text-purple-600/90", dot: "bg-purple-500" },
  emerald: { pill: "border-emerald-200 bg-emerald-50 text-emerald-600", text: "text-emerald-600/90", dot: "bg-emerald-500" },
} as const;

/** Small step-indicator dot that morphs into a filled checkmark the moment
 * its line resolves — the same "step completed" language as a checklist
 * or onboarding stepper, not a scanner effect. */
function LineDot({ tint, delay, active }: { tint?: keyof typeof TAG_STYLES; delay: number; active: boolean }) {
  const solid = tint ? TAG_STYLES[tint].dot : "bg-slate-400";
  return (
    <span className="relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-white">
      <span
        className={cn("absolute inset-0 rounded-full border-2 border-slate-200", active && "animate-dot-out")}
        style={active ? { animationDelay: `${delay}s` } : undefined}
      />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full text-white opacity-0",
          solid,
          active && "animate-dot-in",
        )}
        style={active ? { animationDelay: `${delay}s` } : undefined}
      >
        <Check className="h-2 w-2" strokeWidth={3.5} />
      </span>
    </span>
  );
}

function DocLine({
  before,
  after,
  label,
  tint,
  delay,
  active,
}: {
  before: string;
  after: string;
  label?: string;
  tint?: keyof typeof TAG_STYLES;
  delay: number;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <LineDot tint={tint} delay={delay} active={active} />
      <div className="relative h-3 min-w-0 flex-1">
        <span
          className={cn(
            "absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-[8.5px] font-medium text-slate-600",
            active && "animate-doc-line-out",
          )}
          style={active ? { animationDelay: `${delay}s` } : undefined}
        >
          {before}
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-[8.5px] italic opacity-0",
            tint ? TAG_STYLES[tint].text : "text-slate-500",
            active && "animate-doc-line-in",
          )}
          style={active ? { animationDelay: `${delay}s` } : undefined}
        >
          {after}
        </span>
      </div>
      {label && tint && (
        <span
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide opacity-0",
            TAG_STYLES[tint].pill,
            active && "animate-tag-pop",
          )}
          style={active ? { animationDelay: `${delay}s` } : undefined}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/** Header status chip: "Analyzing" while the beam is still working through
 * the lines, crossfading to "Formula Extracted" once the last one resolves.
 * Fixed width + right-aligned so the text swap never shifts the header. */
function StatusPill({ active }: { active: boolean }) {
  return (
    <div className="relative h-4 w-[104px] shrink-0">
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-end gap-1.5 whitespace-nowrap text-[8px] font-semibold uppercase tracking-wide text-slate-400",
          active && "animate-status-scanning",
        )}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
        Analyzing
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-end gap-1 whitespace-nowrap text-[8px] font-semibold uppercase tracking-wide text-emerald-600 opacity-0",
          active && "animate-status-done",
        )}
      >
        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-2 w-2" strokeWidth={3.5} />
        </span>
        Extracted
      </span>
    </div>
  );
}

function FormulaMockup({ active }: { active: boolean }) {
  return (
    <div className="relative flex w-full items-center justify-center" aria-hidden>
      <div className="w-full overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/[0.04]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
            <span className="ml-1 text-[7px] font-semibold uppercase tracking-wider text-slate-300">script.txt</span>
          </div>
          <StatusPill active={active} />
        </div>

        <div className="relative px-4 py-4">
          {/* Vertical progress rail — grows top-down as each line resolves,
              the same "reading down the doc" story the old scan beam told,
              but as a stepper track instead of a sci-fi scan-line overlay. */}
          <div aria-hidden className="absolute left-[23px] top-[23px] bottom-[23px] w-px bg-slate-100" />
          <div
            aria-hidden
            className={cn(
              "absolute left-[23px] top-[23px] bottom-[23px] w-px origin-top bg-gradient-to-b from-blue-400 via-purple-400 to-emerald-400",
              active && "animate-rail-fill",
            )}
            style={!active ? { transform: "scaleY(0)" } : undefined}
          />

          <div className="space-y-3">
            {FORMULA_LINES.map((line, i) => (
              <DocLine key={i} {...line} delay={i * LINE_STAGGER} active={active} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Phase 1 (0-36%): the winning video, with its engagement numbers
 * beside it — the same proof-of-virality language as Step 1's card,
 * establishing this is the same hook, about to be rewritten. */
function SourceVideoPhase({ active }: { active: boolean }) {
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center gap-2.5", active && "animate-bend-video")}>
      <div className="relative h-[168px] w-[110px] overflow-hidden rounded-xl border border-white/40 shadow-xl">
        <Image src="/hook-thumb-2.png" alt="" fill sizes="110px" className="object-cover" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/40 to-transparent"
        />
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[7px] font-semibold text-white backdrop-blur-md">
          <Eye className="h-2 w-2" />
          2.6M
        </span>
        <span className="absolute inset-x-0 bottom-1.5 text-center text-[9px] font-extrabold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          the hook
        </span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <span className="flex flex-col items-center gap-0.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white shadow-md">
            <Heart className="h-3 w-3 fill-white" />
          </span>
          <span className="text-[6.5px] font-bold text-slate-500">657K</span>
        </span>
        <span className="flex flex-col items-center gap-0.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white shadow-md">
            <MessageCircle className="h-3 w-3" />
          </span>
          <span className="text-[6.5px] font-bold text-slate-500">233K</span>
        </span>
      </div>
    </div>
  );
}

/** Phase 2 (32-66%): a beat between input and output — the pill names
 * what's happening to the video before the document backing it shows up. */
function BendPillPhase({ active }: { active: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-white opacity-0 shadow-xl shadow-emerald-500/40",
          active && "animate-bend-pill",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Script Bend
      </span>
    </div>
  );
}

const BEND_LINE_WIDTHS = [92, 100, 78, 88, 60] as const;

/** Phase 3 (62-100%): the rewritten script resolves as a document — same
 * hook and structure, new topic — echoing Step 2's doc-card language so
 * the three steps read as one continuous pipeline. */
function ScriptDocPhase({ active }: { active: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className={cn(
          "w-5/6 overflow-hidden rounded-2xl bg-white p-4 opacity-0 shadow-xl ring-1 ring-slate-900/[0.04]",
          active && "animate-bend-doc",
        )}
      >
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Sparkles className="h-2.5 w-2.5" />
          </span>
          <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-700">Script Bend</span>
        </div>
        <div className="mt-3 space-y-2">
          {BEND_LINE_WIDTHS.map((width, i) => (
            <div
              key={i}
              className={cn("h-2 rounded-full bg-slate-100 opacity-0", active && "animate-bend-doc-line")}
              style={{ width: `${width}%`, animationDelay: active ? `${i * 0.22}s` : undefined }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GenerateMockup({ active }: { active: boolean }) {
  return (
    <div className="relative h-full w-full" aria-hidden>
      <SourceVideoPhase active={active} />
      <BendPillPhase active={active} />
      <ScriptDocPhase active={active} />
    </div>
  );
}

function StepOneCard() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref}>
      <CardShell step={1} title="Find a Viral Hook" description="Start with a proven video that already has millions of views.">
        <HookMockup active={inView} />
      </CardShell>
    </div>
  );
}

function StepTwoCard() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref}>
      <CardShell
        step={2}
        title="Extract the Formula"
        description="Our AI turns the script into a fill-in-the-blank template — hook, pattern, and facts kept, topic stripped out."
      >
        <FormulaMockup active={inView} />
      </CardShell>
    </div>
  );
}

function StepThreeCard() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref}>
      <CardShell
        step={3}
        title="Bend & Dominate"
        description="Keep the psychology, swap the topic, and generate your non-competitive script."
      >
        <GenerateMockup active={inView} />
      </CardShell>
    </div>
  );
}

export function VerlabProcess() {
  return (
    <section className="w-full py-24">
      <div className="text-center">
        <span
          className="relative mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-slate-100 [text-shadow:0_1px_1px_rgba(0,0,0,0.5)]"
          style={{
            backgroundImage:
              "linear-gradient(160deg, #e2e8f0 0%, #94a3b8 10%, #334155 32%, #0b1220 52%, #1e293b 70%, #64748b 88%, #cbd5e1 100%)",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -6px rgba(15,23,42,0.55), 0 2px 4px rgba(15,23,42,0.4)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-5 top-px h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent"
          />
          <CircleDot className="h-3.5 w-3.5 text-slate-300" />
          How it Works
          <CircleDot className="h-3.5 w-3.5 text-slate-300" />
        </span>
        <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
          Go Viral in 3 Simple Steps
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm font-normal text-slate-500 md:text-base">
          Discover viral ideas, extract what makes them work, and transform them into unique scripts tailored to your niche.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-8 px-8 sm:px-6 md:grid-cols-3 md:px-4">
        <StepOneCard />
        <StepTwoCard />
        <StepThreeCard />
      </div>
    </section>
  );
}
