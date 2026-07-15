"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { STATUS_HEX } from "@/lib/charts";

export function Sparkline({
  data,
  positive = true,
  height = 32,
  width = 96,
}: {
  data: number[];
  positive?: boolean;
  height?: number;
  width?: number;
}) {
  const { resolvedTheme } = useTheme();
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const accent = STATUS_HEX[positive ? "good" : "critical"][resolvedTheme];
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-hairline" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={accent} stroke={resolvedTheme === "dark" ? "#0a0a0d" : "#ffffff"} strokeWidth={1.5} />
    </svg>
  );
}
