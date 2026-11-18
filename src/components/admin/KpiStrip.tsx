import { Children, type CSSProperties, type ReactNode } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { AnimatedNumber } from "@/components/admin/AnimatedNumber";
import { cn } from "@/lib/utils";

/** A page's headline numbers: a row of cards, one figure each. */
export function KpiStrip({ children }: { children: ReactNode }) {
  const count = Children.count(children);
  return (
    <div className={cn("grid grid-cols-1 gap-4", count === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}>
      {children}
    </div>
  );
}

export interface KpiDelta {
  /** Signed, e.g. "+12" or "−3.4%". */
  value: string;
  /** What the change is measured against, e.g. "vs yesterday". */
  label?: string;
  direction?: "up" | "down" | "flat";
  /** Color = direction × whether that direction is good. */
  sentiment?: "positive" | "negative" | "neutral";
}

export type KpiTone = "positive" | "warning" | "negative" | "neutral";

/** Status ink for the figure, and the tint its disc and glow take. */
const TONE_TEXT: Record<KpiTone, string> = {
  positive: "text-success",
  warning: "text-warning",
  negative: "text-danger",
  neutral: "text-heading",
};
const TONE_TINT: Record<Exclude<KpiTone, "neutral">, string> = {
  positive: "var(--viz-good)",
  warning: "var(--viz-warning)",
  negative: "var(--viz-critical)",
};

/**
 * Which way a rate reads: good at or past `good`, a warning down to `warn`,
 * bad past that. `higherIsBetter: false` flips it for error and churn rates.
 */
export function rateTone(value: number | null, good: number, warn: number, higherIsBetter = true): KpiTone {
  if (value === null || Number.isNaN(value)) return "neutral";
  if (higherIsBetter) return value >= good ? "positive" : value >= warn ? "warning" : "negative";
  return value <= good ? "positive" : value <= warn ? "warning" : "negative";
}

export function Kpi({
  label,
  value,
  delta,
  footnote,
  indicator,
  icon: Icon,
  accent = false,
  tone,
}: {
  label: string;
  value: ReactNode;
  delta?: KpiDelta;
  footnote?: ReactNode;
  /** Small live mark beside the label. */
  indicator?: ReactNode;
  /** A Phosphor icon (from "@phosphor-icons/react/dist/ssr"); drawn filled. */
  icon?: PhosphorIcon;
  /** The page's lead figure: its icon takes the accent. */
  accent?: boolean;
  /**
   * Whether the figure is good news: green, amber or red ink on the figure
   * and its icon. Left out, it follows the delta's sentiment; figures with
   * no judgement to make stay in plain ink.
   */
  tone?: KpiTone;
}) {
  const isWord = typeof value === "string" && !/^[$€£−-]?\d/.test(value);
  const context = [delta ? `${delta.value}${delta.label ? ` ${delta.label}` : ""}` : null, footnote]
    .filter(Boolean)
    .join(" · ");
  const status: KpiTone = tone ?? delta?.sentiment ?? "neutral";
  const tinted = accent || status !== "neutral";
  return (
    // A stat chip: a disc a little taller than the chip, pushed past its left
    // edge so the chip clips it, then two lines -- the figure and what it is. The change and its
    // context ("+12 last 30 days", "of last 150") ride in the tooltip and the
    // accessible name; status shows as the figure's color.
    <div
      title={context ? `${label} · ${context}` : label}
      className={cn(
        "admin-kpi group/kpi flex h-[72px] min-w-0 items-center gap-[18px] pr-5",
        accent && "admin-kpi-lead",
        // Plain tiles light up in their own hue on hover (globals.css).
        !tinted && "admin-kpi-hover"
      )}
      style={status !== "neutral" ? ({ "--kpi-tint": TONE_TINT[status] } as CSSProperties) : undefined}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "-my-1.5 -ml-3 flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full pl-3",
            tinted ? "admin-kpi-disc-tinted" : "admin-kpi-disc"
          )}
        >
          <Icon className="admin-kpi-glyph h-8 w-8" weight="fill" />
        </span>
      ) : (
        <span className="w-1 shrink-0" />
      )}
      <div className="admin-kpi-text min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-semibold leading-[1.15] tracking-[-0.01em]",
            isWord ? "text-[18px]" : "text-[22px]",
            status !== "neutral"
              ? TONE_TEXT[status]
              : accent
                ? "text-heading"
                : "text-body transition-colors duration-200 group-hover/kpi:text-heading"
          )}
        >
          {typeof value === "string" ? <AnimatedNumber value={value} /> : value}
        </p>
        <p
          className={cn(
            "mt-0.5 flex min-w-0 items-center gap-1.5 text-[15px] leading-5",
            tinted ? "text-body" : "text-subtle transition-colors duration-200 group-hover/kpi:text-body"
          )}
        >
          <span className="truncate">{label}</span>
          {indicator}
          {context && <span className="sr-only">, {context}</span>}
        </p>
      </div>
    </div>
  );
}

/** Formats a signed integer change for a KPI delta. */
export function signed(n: number, suffix = ""): string {
  if (n === 0) return `0${suffix}`;
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-US")}${suffix}`;
}
