import type { ToolTone } from "@/lib/types";

/**
 * Chart colors resolve through a CSS variable with the app default baked in as
 * the fallback, e.g. `var(--chart-blue, #3b82f6)`. Nothing defines those
 * variables at the document root, so every surface keeps the exact hex below —
 * but a themed subtree (see `.admin-theme` in globals.css) can restyle every
 * chart in one place by declaring them. Inline `style`/SVG paint accepts the
 * var() form everywhere these values are used (fill, stroke, background).
 */
function themed(name: string, light: string, dark: string): { light: string; dark: string } {
  return { light: `var(--chart-${name}, ${light})`, dark: `var(--chart-${name}, ${dark})` };
}

/**
 * Categorical series palette. Fixed slot order (never cycled/reassigned) —
 * validated with the dataviz skill's six-checks script against this app's
 * light (#ffffff) and dark (#0a0a0d) surfaces.
 */
export const TONE_HEX: Record<ToolTone, { light: string; dark: string }> = {
  blue: themed("blue", "#3b82f6", "#3b82f6"),
  green: themed("green", "#10b981", "#059669"),
  amber: themed("amber", "#f59e0b", "#d97706"),
  violet: themed("violet", "#8b5cf6", "#8b5cf6"),
  rose: themed("rose", "#f43f5e", "#f43f5e"),
  sky: themed("sky", "#0ea5e9", "#0284c7"),
  // 7th categorical slot -- added for Video Generator. Kept clearly distinct
  // from amber (more yellow/gold) despite both sitting in the warm range.
  orange: themed("orange", "#f97316", "#ea580c"),
};

export const STATUS_HEX = {
  good: themed("good", "#16a34a", "#34d399"),
  warning: themed("warning", "#f59e0b", "#fbbf24"),
  critical: themed("critical", "#dc2626", "#f87171"),
};

export const CHART_CHROME = {
  grid: themed("grid", "#e5e5e5", "#1c1c1f"),
  axis: themed("axis", "#525866", "#75757f"),
};

export function toneHex(tone: ToolTone, resolvedTheme: "light" | "dark"): string {
  return TONE_HEX[tone][resolvedTheme];
}

/** Formats a date-only ("YYYY-MM-DD") string, pinned to UTC so it never shifts by a day in other timezones. */
export function formatChartDate(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Appends an alpha channel (0-100) to a #rrggbb hex color. */
export function withAlpha(hex: string, alphaPct: number): string {
  const a = Math.round((alphaPct / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
