"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Sparkles, TrendingUp, Wand2 } from "lucide-react";
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

export function BendPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="flex items-center justify-center gap-3">
      <div className="rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Source</span>
        <p className="text-xs font-semibold text-heading">Medical Malpractice</p>
      </div>
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        {inView && (
          <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-primary/50 blur-md animate-craft-glow" />
        )}
        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
          <Wand2 className={cn("h-3.5 w-3.5", inView && "animate-dash-wand-spin")} />
        </span>
      </div>
      <div
        className={cn(
          "rounded-card-sm border border-primary/30 bg-primary/10 px-3 py-2.5 text-left",
          inView && "animate-tag-pop",
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Your niche</span>
        <p className="text-xs font-semibold text-heading">Corporate Fraud</p>
      </div>
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
