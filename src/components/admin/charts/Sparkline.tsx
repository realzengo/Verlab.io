/**
 * A KPI's recent shape: the line in the de-emphasis hue, today's point in the
 * accent. No axes, no hover -- the number beside it is the readout.
 */
export function Sparkline({ data, width = 88, height = 32 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;

  const pad = 4; // room for the end dot and its ring
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    // A flat series sits mid-height rather than on the floor.
    const y = max === min ? height / 2 : pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden="true">
      <path
        d={path}
        fill="none"
        style={{ stroke: "var(--viz-muted)" }}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={3} style={{ fill: "var(--viz-1)", stroke: "var(--color-surface)" }} strokeWidth={2} />
    </svg>
  );
}
