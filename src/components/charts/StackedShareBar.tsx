"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { toneHex } from "@/lib/charts";
import type { ToolTone } from "@/lib/types";

export function StackedShareBar({
  segments,
}: {
  segments: { label: string; value: number; tone: ToolTone }[];
}) {
  const { resolvedTheme } = useTheme();
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  return (
    <div>
      <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: toneHex(seg.tone, resolvedTheme) }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: toneHex(seg.tone, resolvedTheme) }} />
            <span className="text-body">{seg.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-heading">{seg.value}</span>
            <span className="w-12 text-right text-xs tabular-nums text-subtle">
              {((seg.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
