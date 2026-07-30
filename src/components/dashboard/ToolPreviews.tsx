"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gates a preview's motion loop to when it actually scrolls into view,
 * instead of firing (and burning cycles) at mount while off-screen. Mirrors
 * the same hook in VerlabProcess so both surfaces animate the same way. */
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

/** One viral source fans out into several bent niche ideas — two curved
 * connectors draw in from the source card to two stacked idea cards, each
 * idea card popping in right as its connector finishes drawing. Both
 * connectors reuse VerlabProcess's `.animate-graph-draw` (a generic
 * stroke-dashoffset draw-in) so this stays on the same 6s clock as the idea
 * cards' `.animate-dash-fan-card`, phase-shifted per branch via
 * animation-delay instead of separate keyframes. */
const BEND_IDEAS = [
  { label: "Corporate Fraud", lines: ["w-full", "w-3/5"] },
  { label: "Insurance Scandals", lines: ["w-4/5", "w-2/5"] },
] as const;

export function BendPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="relative h-[132px] w-[240px]">
      <svg aria-hidden viewBox="0 0 240 132" className="absolute inset-0 h-full w-full overflow-visible">
        <path
          d="M84,66 C108,66 108,24 132,24"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          className={inView ? "animate-graph-draw" : undefined}
          style={!inView ? { opacity: 0 } : undefined}
        />
        <path
          d="M84,66 C108,66 108,108 132,108"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          className={inView ? "animate-graph-draw" : undefined}
          style={inView ? { animationDelay: "0.3s" } : { opacity: 0 }}
        />
      </svg>

      <div className="absolute left-0 top-1/2 z-10 w-[84px] -translate-y-1/2 rounded-card-sm border border-hairline bg-surface px-2.5 py-2.5 text-left shadow-card">
        {inView && (
          <span aria-hidden className="absolute inset-0 -z-10 rounded-card-sm bg-primary/30 blur-md animate-craft-glow" />
        )}
        <span className="text-[8px] font-semibold uppercase tracking-wide text-body">Source</span>
        <p className="text-[10px] font-semibold leading-tight text-heading">Medical Malpractice</p>
      </div>

      {BEND_IDEAS.map((idea, i) => (
        <div
          key={idea.label}
          className={cn(
            "absolute right-0 z-10 w-[108px] rounded-card-sm border border-hairline bg-surface p-2 text-left shadow-card",
            i === 0 ? "top-0" : "bottom-0",
            inView && "animate-dash-fan-card",
          )}
          style={inView ? { animationDelay: `${i * 0.3}s` } : { opacity: 0 }}
        >
          <span className="inline-block whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[8px] font-bold text-white">
            {idea.label}
          </span>
          <div className="mt-1.5 flex flex-col gap-1">
            {idea.lines.map((width) => (
              <span key={width} className={cn("h-1 rounded-full bg-zinc-200 dark:bg-zinc-700", width)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const NICHE_ROWS = [
  { name: "Medical Malpractice", category: "True crime", score: 94 },
  { name: "Corporate Espionage", category: "Business", score: 88 },
];

export function NicheFinderPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex w-full max-w-[240px] flex-col gap-2">
      {NICHE_ROWS.map((row, i) => (
        <div
          key={row.name}
          className={cn(
            "flex items-center justify-between rounded-card-sm border border-hairline bg-surface px-3 py-2 text-left shadow-card",
            inView && "animate-dash-row-in",
          )}
          style={inView ? { animationDelay: `${i * 0.5}s` } : undefined}
        >
          <div>
            <p className="text-xs font-semibold text-heading">{row.name}</p>
            <p className="text-[10px] text-body">{row.category}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
            <TrendingUp
              className={cn("h-3 w-3", inView && "animate-tooltip-bounce")}
              style={inView ? { animationDelay: `${i * 0.5}s` } : undefined}
            />
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ImageGeneratorPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex items-center gap-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-card-sm border border-hairline bg-gradient-to-br from-accent to-primary/15 shadow-card">
        {inView && (
          <span aria-hidden className="absolute inset-0 -z-10 rounded-card-sm bg-primary/30 blur-lg animate-craft-glow" />
        )}
        <ImageIcon className="h-6 w-6 text-primary" />
      </div>
      <div className="relative flex items-center gap-1.5 overflow-hidden rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-medium text-heading">Generating thumbnail...</span>
        {inView && (
          <span
            aria-hidden
            className="animate-shimmer-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/15"
          />
        )}
      </div>
    </div>
  );
}

export function DownloaderPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex w-full max-w-[220px] flex-col gap-1.5 rounded-card-sm border border-hairline bg-surface p-3 text-left shadow-card">
      <div className="flex items-center gap-2">
        <Download className={cn("h-3.5 w-3.5 shrink-0 text-primary", inView && "animate-tooltip-bounce")} />
        <span className="truncate text-xs font-medium text-heading">tiktok.com/@creator/video</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className={cn("h-full rounded-full bg-primary", inView ? "animate-dash-progress-loop" : "w-2/3")} />
      </div>
    </div>
  );
}

const TRANSCRIPT_LINES = [
  { t: "0:04", text: "The $2.3M mistake surgeons hope you never learn about..." },
  { t: "0:09", text: "Here’s what actually happened..." },
];

export function TranscriptPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex w-full max-w-[220px] flex-col gap-1.5 text-left">
      {TRANSCRIPT_LINES.map((line, i) => (
        <div
          key={line.t}
          className={cn("flex gap-2 text-[11px] text-body", inView && "animate-dash-row-in")}
          style={inView ? { animationDelay: `${i * 0.9}s` } : undefined}
        >
          <span className="font-mono">{line.t}</span>
          <span className="line-clamp-1">
            {line.text}
            {i === TRANSCRIPT_LINES.length - 1 && (
              <span className={cn("ml-0.5 inline-block h-2.5 w-[3px] translate-y-0.5 bg-primary", inView && "animate-caret-blink")} />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

const SCRIPT_BEATS = ["Hook", "Body", "CTA"];

export function ScriptPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex items-center gap-1.5">
      {SCRIPT_BEATS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div
            className={cn(
              "rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-center shadow-card",
              inView && "animate-dash-beat-cycle",
            )}
            style={inView ? { animationDelay: `${i * 1.2}s` } : undefined}
          >
            <span className="text-[11px] font-semibold">{label}</span>
          </div>
          {i < SCRIPT_BEATS.length - 1 && <div className="h-px w-3 bg-hairline" />}
        </div>
      ))}
    </div>
  );
}
