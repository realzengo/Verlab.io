import { Children, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/admin/charts/Sparkline";
import { cn } from "@/lib/utils";

/**
 * A page's headline numbers as one object: cells separated by hairlines in a
 * single bordered strip, rather than a row of separately boxed cards.
 */
export function KpiStrip({ children }: { children: ReactNode }) {
  const count = Children.count(children);
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hairline bg-hairline shadow-card",
        count === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"
      )}
    >
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

const SENTIMENT_CLASS = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-subtle",
};

export function Kpi({
  label,
  value,
  delta,
  trend,
  footnote,
  indicator,
}: {
  label: string;
  value: ReactNode;
  delta?: KpiDelta;
  /** Recent daily values; the last point is today. */
  trend?: number[];
  footnote?: ReactNode;
  /** Small live mark beside the label. */
  indicator?: ReactNode;
}) {
  const Arrow = delta?.direction === "down" ? ArrowDownRight : delta?.direction === "flat" ? ArrowRight : ArrowUpRight;
  return (
    <div className="flex min-w-0 flex-col justify-between gap-4 bg-surface p-5">
      <div className="flex items-center gap-2">
        <p className="truncate text-[13px] font-medium text-subtle">{label}</p>
        {indicator}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[28px] font-semibold leading-none tracking-[-0.025em] text-heading">{value}</p>
          {(delta || footnote) && (
            <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
              {delta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium tabular-nums",
                    SENTIMENT_CLASS[delta.sentiment ?? "neutral"]
                  )}
                >
                  {delta.direction && <Arrow className="h-3.5 w-3.5" aria-hidden="true" />}
                  {delta.value}
                </span>
              )}
              {delta?.label && <span className="text-subtle">{delta.label}</span>}
              {footnote && <span className="text-subtle">{footnote}</span>}
            </p>
          )}
        </div>
        {trend && trend.length > 1 && <Sparkline data={trend} />}
      </div>
    </div>
  );
}

/** Formats a signed integer change for a KPI delta. */
export function signed(n: number, suffix = ""): string {
  if (n === 0) return `0${suffix}`;
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-US")}${suffix}`;
}
