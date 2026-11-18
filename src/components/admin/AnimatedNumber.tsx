"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// Set once the first commit's effects have run. Everything mounting after
// that arrived by client navigation, so its figures are fresh on screen.
let afterFirstCommit = false;

// A whole figure only: an optional currency sign, the number, an optional
// unit. Words with a digit in them ("Veo 3") are left alone.
const FIGURE = /^([$€£]?)(\d[\d,]*(?:\.\d+)?)(%|[KMB])?$/;

/** Whether a figure that was server-rendered has been on screen long enough
 *  that counting it up from zero would read as a glitch, not an entrance. */
function seenTooLong(): boolean {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const shownAt = nav?.responseEnd || 0;
  return performance.now() - shownAt > 700;
}

/**
 * A formatted figure ("$23.62", "1,204", "0.4%", "1.2K") that counts up from zero on
 * arrival, keeping its prefix, suffix, grouping and decimals. Server-rendered
 * with the final value, so it reads correctly before (or without) the count.
 */
export function AnimatedNumber({ value, duration = 1100 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const match = value.trim().match(FIGURE);
    if (!el || !match) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!afterFirstCommit && seenTooLong()) return;

    const [, head, raw, tail = ""] = match;
    const target = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    const format = (n: number) =>
      head +
      n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: raw.includes(","),
      }) +
      tail;

    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = format(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    el.textContent = format(0);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = value;
    };
  }, [value, duration]);

  useEffect(() => {
    afterFirstCommit = true;
  }, []);

  // Keyed on the value: the effect writes this span's text directly, so a new
  // value gets a fresh node rather than React patching one it no longer owns.
  return (
    <span key={value} ref={ref} className="tabular-nums">
      {value}
    </span>
  );
}
