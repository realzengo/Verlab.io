import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { NavMenuTone } from "@/lib/types";
import { cn } from "@/lib/utils";

// One diagonal gradient per tone, light top-left to deep bottom-right. The
// 14%/86% stops are where the reference tiles were sampled.
const TONE_GRADIENT: Record<NavMenuTone, string> = {
  red: "linear-gradient(135deg, #eb5b61 14%, #ea3642 86%)",
  orange: "linear-gradient(135deg, #eeaa61 14%, #e9823b 86%)",
  green: "linear-gradient(135deg, #70d281 14%, #51a95b 86%)",
  purple: "linear-gradient(135deg, #9c81f1 14%, #7a49e6 86%)",
  blue: "linear-gradient(135deg, #6497f5 14%, #3e6be6 86%)",
  pink: "linear-gradient(135deg, #e783b9 14%, #dc5c9c 86%)",
};

// Same proportions at every size: corner radius ~29% of the tile, glyph ~57%.
const SIZES = {
  sm: { tile: "h-7 w-7 rounded-[8px]", glyph: 16 }, // sidebar Tools menu
  lg: { tile: "h-12 w-12 rounded-[14px]", glyph: 27 }, // home tool cards
} as const;

/**
 * A tool's app icon: its filled white glyph on its tone's gradient tile. The
 * sidebar's Tools menu and the home tool cards both draw tools with this, so
 * a tool looks the same everywhere (icon + tone come from TOOLS_MENU).
 */
export function ToolTile({
  icon: Glyph,
  tone,
  size = "sm",
  className,
}: {
  icon: PhosphorIcon;
  tone: NavMenuTone;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { tile, glyph } = SIZES[size];
  return (
    <span
      aria-hidden="true"
      style={{ backgroundImage: TONE_GRADIENT[tone] }}
      className={cn(
        "flex shrink-0 items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]",
        tile,
        className
      )}
    >
      <Glyph size={glyph} weight="fill" className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]" />
    </span>
  );
}
