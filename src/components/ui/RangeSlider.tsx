"use client";

/** Dual-handle range slider -- two native `<input type="range">` stacked on
 * the same track (the standard technique for this, since there's no single
 * form control for a two-handle range). Each input is pointer-events-none
 * except for its thumb (see `.premium-slider` in globals.css), so dragging
 * only ever grabs a handle, never the track underneath. */
export function RangeSlider({
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
}) {
  const span = max - min || 1;
  const pctMin = ((valueMin - min) / span) * 100;
  const pctMax = ((valueMax - min) / span) * 100;
  // When the handles are close together the lower one gets buried under the
  // upper one's hit target -- lift it above once they're within 5% of the
  // track so both stay grabbable.
  const minOnTop = valueMax - valueMin < span * 0.05;

  return (
    <div className="relative flex h-4 w-full items-center">
      <div className="pointer-events-none absolute inset-x-0 h-1.5 rounded-full bg-hairline" />
      <div
        className="pointer-events-none absolute h-1.5 rounded-full bg-primary"
        style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }}
      />
      <input
        type="range"
        aria-label="Minimum"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax), valueMax)}
        className="premium-slider pointer-events-none absolute inset-x-0 h-4 w-full bg-transparent"
        style={{ zIndex: minOnTop ? 5 : 3 }}
      />
      <input
        type="range"
        aria-label="Maximum"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin))}
        className="premium-slider pointer-events-none absolute inset-x-0 h-4 w-full bg-transparent"
        style={{ zIndex: 4 }}
      />
    </div>
  );
}
