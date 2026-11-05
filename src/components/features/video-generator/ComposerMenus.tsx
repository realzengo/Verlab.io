"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GLASS_PANEL } from "@/components/ui/PillDropdown";

// Shared by the Clone composer's bar and the image dialog's prompt bar
// (FrameImageGenerateModal): soft grey pills that open a glass menu.
//
// cn() here is a plain join (no tailwind-merge), so conflicting utilities
// can't be overridden by appending -- padding and fill are picked per state
// instead of layered on top of one base string.
export const COMPOSER_PILL_SHAPE =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-medium text-slate-800 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/50 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-100";
export const COMPOSER_PILL_IDLE = "bg-slate-100 hover:bg-slate-200/70 dark:bg-white/[0.07] dark:hover:bg-white/[0.11]";
export const COMPOSER_PILL_OPEN = "bg-slate-200/80 dark:bg-white/[0.12]";
export const MENU_ITEM_BASE =
  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors disabled:pointer-events-none disabled:opacity-50";
export const MENU_ITEM_IDLE = "hover:bg-slate-100 focus-visible:bg-slate-100 dark:hover:bg-white/[0.06] dark:focus-visible:bg-white/[0.06]";
export const MENU_ITEM_SELECTED = "bg-slate-100 dark:bg-white/[0.06]";
export const MENU_ICON_TILE =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300";

/** Click-outside / Escape handling shared by every popover in a bar. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Claimed, so a dialog hosting this bar doesn't close on the same key.
      event.preventDefault();
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}

// Below lg a dropdown anchored to a pill runs off the screen's right edge, so
// there it becomes a bottom sheet over a scrim. The max-lg: utilities sort
// after the panel's own width classes, so they win only on phones.
const PHONE_SHEET =
  "max-lg:fixed max-lg:left-3 max-lg:right-3 max-lg:top-auto max-lg:bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:mt-0 max-lg:mb-0 max-lg:w-auto max-lg:origin-bottom max-lg:rounded-3xl max-lg:p-2";

export type PopoverPlacement = "below" | "above";

export function PopoverPanel({
  open,
  onClose,
  title,
  placement = "below",
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Heads the phone sheet, where the pill that opened it is no longer beside it. */
  title: string;
  /** "above" for bars docked at the bottom of a dialog, where a downward menu would overflow. */
  placement?: PopoverPlacement;
  className?: string;
  children: ReactNode;
}) {
  const above = placement === "above";
  return (
    // Two keyed direct children (not a fragment) so AnimatePresence can run
    // each one's exit.
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          aria-hidden
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}
      {open && (
        <motion.div
          key="panel"
          role="menu"
          initial={{ opacity: 0, y: above ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: above ? 4 : -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute left-0 z-50 rounded-2xl p-1.5",
            above ? "bottom-full mb-2 origin-bottom-left" : "top-full mt-2 origin-top-left",
            GLASS_PANEL,
            className,
            PHONE_SHEET
          )}
        >
          <p className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-slate-500 lg:hidden dark:text-slate-400">{title}</p>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface MenuOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/** A bar pill that opens a single-choice menu -- label + optional subline per option, check on the current one. */
export function ChoicePill({
  value,
  options,
  onChange,
  triggerIcon,
  triggerLabel,
  panelClassName,
  ariaLabel,
  placement,
}: {
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
  triggerIcon?: ReactNode;
  triggerLabel?: string;
  panelClassName: string;
  ariaLabel: string;
  placement?: PopoverPlacement;
}) {
  const { open, setOpen, ref } = usePopover();
  const current = options.find((option) => option.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(COMPOSER_PILL_SHAPE, "px-3.5", open ? COMPOSER_PILL_OPEN : COMPOSER_PILL_IDLE)}
      >
        {triggerIcon}
        {triggerLabel ?? current?.label}
      </button>
      <PopoverPanel open={open} onClose={() => setOpen(false)} title={ariaLabel} placement={placement} className={panelClassName}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={option.value === value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className={cn(MENU_ITEM_BASE, option.value === value ? MENU_ITEM_SELECTED : MENU_ITEM_IDLE)}
          >
            {option.icon && <span className={MENU_ICON_TILE}>{option.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900 dark:text-white">{option.label}</span>
              {option.description && <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">{option.description}</span>}
            </span>
            {option.value === value && <Check className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />}
          </button>
        ))}
      </PopoverPanel>
    </div>
  );
}
