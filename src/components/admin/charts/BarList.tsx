import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatValue, type ValueFormat } from "./format";

export interface BarListItem {
  label: string;
  value: number;
  href?: string;
}

/**
 * A ranked list where each row carries its own magnitude as a wash behind the
 * label. One measure across nominal categories, so one color for every bar --
 * hue would only restate the length. The value sits at the tip, in ink.
 */
export function BarList({
  items,
  format = "number",
  showShare = true,
  emptyLabel = "No data yet",
}: {
  items: BarListItem[];
  format?: ValueFormat;
  /** Each row's share of the list total, after the value. */
  showShare?: boolean;
  emptyLabel?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);

  if (items.length === 0 || total === 0) {
    return <p className="py-6 text-center text-[13px] text-subtle">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        const label = (
          <span className="relative z-10 block truncate px-2.5 text-[13px] leading-7 text-heading">{item.label}</span>
        );
        return (
          <li key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="relative">
              {item.value > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 rounded-r-[4px] bg-(--viz-1-wash)"
                  style={{ width: `max(${pct}%, 4px)` }}
                />
              )}
              {item.href ? (
                <Link href={item.href} className={cn("relative block rounded-[4px] hover:underline")}>
                  {label}
                </Link>
              ) : (
                label
              )}
            </div>
            <span className="flex items-baseline gap-2 text-[13px] tabular-nums">
              <span className="font-medium text-heading">{formatValue(item.value, format)}</span>
              {showShare && (
                <span className="w-9 text-right text-[12px] text-subtle">{Math.round((item.value / total) * 100)}%</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
