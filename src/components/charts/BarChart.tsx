"use client";

import { useMemo, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { formatChartDate, toneHex } from "@/lib/charts";
import { formatNumber } from "@/lib/utils";
import type { ToolTone } from "@/lib/types";

export function BarChart({
  labels,
  data,
  tone = "blue",
  height = 180,
  valueFormatter = formatNumber,
}: {
  labels: string[];
  data: number[];
  tone?: ToolTone;
  height?: number;
  valueFormatter?: (n: number) => string;
}) {
  const { resolvedTheme } = useTheme();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = useMemo(() => Math.ceil(Math.max(...data, 1) * 1.1), [data]);
  const color = toneHex(tone, resolvedTheme);
  const n = data.length;
  const gapPct = 0.28;
  const slot = 100 / n;
  const barW = slot * (1 - gapPct);

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col justify-between py-0.5 text-right text-[10px] text-body" style={{ height, width: 32 }}>
          <span>{valueFormatter(max)}</span>
          <span>{valueFormatter(Math.round(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-hairline" />
            <div className="border-t border-hairline" />
            <div className="border-t border-hairline" />
          </div>
          <svg viewBox={`0 0 100 ${height}`} width="100%" height={height} preserveAspectRatio="none" className="relative">
            {data.map((v, i) => {
              const barH = (v / max) * height;
              const x = i * slot + (slot - barW) / 2;
              const isHover = hoverIndex === i;
              return (
                <rect
                  key={i}
                  x={x}
                  y={height - barH}
                  width={barW}
                  height={Math.max(barH, 1)}
                  fill={color}
                  opacity={isHover ? 1 : 0.85}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </svg>
          {hoverIndex !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-y-1 whitespace-nowrap rounded-chip border border-hairline bg-surface px-2.5 py-1.5 text-xs shadow-card-hover"
              style={{
                left: `${hoverIndex * slot + slot / 2}%`,
                transform: `translate(${hoverIndex > n / 2 ? "-100%" : "0%"}, -100%)`,
              }}
            >
              <p className="font-semibold text-heading">{valueFormatter(data[hoverIndex])}</p>
              <p className="text-body">{formatChartDate(labels[hoverIndex])}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-9 text-[10px] text-body">
        {labels.map((label, i) =>
          i % Math.max(1, Math.ceil(n / 7)) === 0 || i === n - 1 ? <span key={label}>{formatChartDate(label)}</span> : null
        )}
      </div>
    </div>
  );
}
