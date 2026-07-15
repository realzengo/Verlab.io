"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { toneHex } from "@/lib/charts";
import { formatNumber } from "@/lib/utils";
import type { ToolTone } from "@/lib/types";

export function RankedBarList({
  items,
}: {
  items: { label: string; value: number; tone: ToolTone }[];
}) {
  const { resolvedTheme } = useTheme();
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs font-medium text-body">{item.label}</span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-app">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: toneHex(item.tone, resolvedTheme) }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-heading">
            {formatNumber(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
