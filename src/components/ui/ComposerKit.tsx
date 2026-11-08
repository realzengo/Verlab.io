"use client";

import { useSyncExternalStore } from "react";

// The generator composer shared by the image and video pages, in the
// BrandKit bezel: a gray rim holding a white prompt sheet (what to make,
// plus Generate), with the render settings on a quiet tray along the rim's
// foot (PillDropdown variant="tray" chips).

export const COMPOSER_RIM =
  "rounded-[28px] border border-[#EBEDF0] bg-[#F5F6F8] p-1.5 dark:border-white/[0.06] dark:bg-white/[0.03]";

/** The white sheet; pair with px-5 so the tray's chips land on its text column. */
export const COMPOSER_SHEET =
  "rounded-[22px] border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-32px_rgba(16,24,40,0.18)] transition-[border-color,box-shadow] duration-150 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 dark:border-white/[0.07] dark:bg-[#141417] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

/** The settings tray: px-[11px] plus a tray chip's own 10px puts each chip's content on the sheet's px-5 text column. */
export const COMPOSER_TRAY = "flex flex-wrap items-center gap-1 px-[11px] pt-1.5";

/** A hairline between tray groups (the model, then its settings). */
export const COMPOSER_TRAY_RULE = "mx-1 h-4 w-px bg-[#E2E4E8] dark:bg-white/[0.08]";

const KEYCAP =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-[#E6E8EC] bg-[#F7F8FA] px-1 text-xs font-medium text-subtle dark:border-white/[0.08] dark:bg-white/[0.04]";

// The keycap reads Ctrl off Apple platforms (⌘ on the server).
const noopSubscribe = () => () => {};
function useModKey() {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "⌘"
  );
}

/**
 * Sits left of Generate: the ⌘↵ keycaps, or a short hint when Generate was
 * pressed with nothing to send. Generate itself never greys out -- it
 * points at what's missing instead (same as /bend and /downloads).
 */
export function SubmitHint({ hint }: { hint: string | null }) {
  const modKey = useModKey();
  if (hint) {
    return (
      <span role="status" className="text-[13px] text-subtle">
        {hint}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="hidden items-center gap-1 lg:flex">
      <kbd className={KEYCAP}>{modKey}</kbd>
      <kbd className={KEYCAP}>↵</kbd>
    </span>
  );
}
