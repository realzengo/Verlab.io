import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Verlab's premium in-app language, first built for the MCP page and shared
// from here so every tool page that uses it stays identical: app-icon tiles
// around the blue Verlab tile, an ink-gradient display title, the
// double-bezel panel with mono step chips, and the ink pill CTA.

/**
 * A neutral app-icon tile: a flat face inside a crisp 1px hairline, a faint
 * lit top edge, and a soft drop shadow that falls onto whatever it overlaps.
 * Sizeless -- set width, height and radius where it's used.
 */
export const APP_TILE =
  "relative flex items-center justify-center overflow-hidden border " +
  "border-[#E3E5E9] bg-white " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,1),0_1px_2px_rgba(15,23,42,0.06),0_10px_24px_-8px_rgba(15,23,42,0.16)] " +
  "dark:border-[#323436] dark:bg-[#1B1D20] " +
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_6px_rgba(0,0,0,0.5),0_16px_32px_-8px_rgba(0,0,0,0.75)]";

/**
 * The Verlab tile, drawn in code like a real app icon: a deep blue body lit
 * from above, one soft sheen at the top-left, a lit top bevel and a shaded
 * bottom bevel, a crisp dark hairline, and neutral layered shadows (contact,
 * mid, ambient) rather than a colored glow.
 */
export function VerlabTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-28 w-28 items-center justify-center overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,#5C8BFF_0%,#335CFF_46%,#1F40D6_100%)] shadow-[0_0_0_0.5px_rgba(10,25,110,0.6),0_1px_2px_rgba(15,23,42,0.22),0_8px_14px_-6px_rgba(16,32,120,0.38),0_28px_44px_-20px_rgba(15,23,42,0.5)] dark:shadow-[0_0_0_0.5px_rgba(150,175,255,0.35),0_2px_4px_rgba(0,0,0,0.6),0_28px_44px_-16px_rgba(0,0,0,0.95)]",
        className
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(120%_80%_at_25%_0%,rgba(255,255,255,0.38),rgba(255,255,255,0)_55%)]" />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(8,18,95,0.5),inset_0_-10px_18px_-8px_rgba(8,18,95,0.45)]" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark */}
      <img
        src="/logo-mark-white.png"
        alt=""
        width={58}
        height={50}
        className="relative w-[58px] [filter:drop-shadow(0_1px_1px_rgba(8,18,95,0.5))_drop-shadow(0_4px_8px_rgba(8,18,95,0.25))]"
      />
    </div>
  );
}

/** Ink display title that fades toward the bottom; pair with your own size and tracking. */
export const INK_TITLE =
  "bg-gradient-to-b from-[#0B0D12] to-[#0B0D12]/60 bg-clip-text pb-1 font-semibold text-transparent dark:from-white dark:to-white/55";

/** The ink pill CTA (white on dark mode). */
export const INK_BUTTON =
  "group inline-flex items-center justify-center gap-2 rounded-full bg-[#0B0D12] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(15,23,42,0.2),0_8px_20px_-10px_rgba(15,23,42,0.5)] transition-colors hover:bg-[#1A1D24] disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-[#0B0D12] dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] dark:hover:bg-[#E9EAEE]";

/** A mono step chip: "01", "02". */
export function MonoChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-fit items-center rounded-md border border-hairline px-2 font-mono text-[11px] font-medium tracking-wider text-subtle",
        className
      )}
    >
      {children}
    </span>
  );
}

/** The double-bezel panel: a soft gray rim holding a white sheet. */
export function BezelPanel({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[30px] border border-[#EBEDF0] bg-[#F5F6F8] p-1.5 dark:border-white/[0.06] dark:bg-white/[0.025]",
        className
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-[24px] border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-32px_rgba(16,24,40,0.18)] dark:border-white/[0.07] dark:bg-[#0E0E10] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
