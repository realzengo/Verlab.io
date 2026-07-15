import type { ToolTone } from "@/lib/types";

/**
 * Categorical series palette. Fixed slot order (never cycled/reassigned) —
 * validated with the dataviz skill's six-checks script against this app's
 * light (#ffffff) and dark (#0a0a0d) surfaces.
 */
export const TONE_HEX: Record<ToolTone, { light: string; dark: string }> = {
  blue: { light: "#3b82f6", dark: "#3b82f6" },
  green: { light: "#10b981", dark: "#059669" },
  amber: { light: "#f59e0b", dark: "#d97706" },
  violet: { light: "#8b5cf6", dark: "#8b5cf6" },
  rose: { light: "#f43f5e", dark: "#f43f5e" },
  sky: { light: "#0ea5e9", dark: "#0284c7" },
};

export const STATUS_HEX = {
  good: { light: "#16a34a", dark: "#34d399" },
  warning: { light: "#f59e0b", dark: "#fbbf24" },
  critical: { light: "#dc2626", dark: "#f87171" },
};

export const CHART_CHROME = {
  grid: { light: "#e5e5e5", dark: "#1c1c1f" },
  axis: { light: "#525866", dark: "#75757f" },
};

export function toneHex(tone: ToolTone, resolvedTheme: "light" | "dark"): string {
  return TONE_HEX[tone][resolvedTheme];
}

/** Appends an alpha channel (0-100) to a #rrggbb hex color. */
export function withAlpha(hex: string, alphaPct: number): string {
  const a = Math.round((alphaPct / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
