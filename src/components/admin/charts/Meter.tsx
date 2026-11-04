import { cn } from "@/lib/utils";

type MeterTone = "accent" | "good" | "warning" | "critical";

const FILL: Record<MeterTone, string> = {
  accent: "var(--viz-1)",
  good: "var(--viz-good)",
  warning: "var(--viz-warning)",
  critical: "var(--viz-critical)",
};

/**
 * A 0-100 reading. The fill carries severity; the unfilled track stays a
 * quiet step so the bar reads as one object across its whole length.
 */
export function Meter({
  value,
  tone = "accent",
  label,
  className,
}: {
  value: number;
  tone?: MeterTone;
  /** Accessible name, e.g. "Job success rate". */
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-(--admin-fill)", className)}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: FILL[tone] }} />
    </div>
  );
}
