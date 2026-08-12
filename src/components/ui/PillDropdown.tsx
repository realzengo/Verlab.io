"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Shared glassy pill styling so the toolbar buttons that live outside this
 * component (ref-image upload, settings) read as one continuous, premium
 * control bar rather than a mix of flat and glass surfaces. */
export const GLASS_PILL_BASE =
  "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1 text-xs font-medium tracking-[-0.01em] outline-none transition-all duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50";

// Opaque-leaning (not translucent) on purpose: these pills sit on top of an
// already-frosted parent panel, so a genuinely translucent fill just
// disappears into it. The "glass" read instead comes from the crisp edge
// (visible border + inset top highlight) and a real contact shadow that
// lifts each pill off the surface -- the macOS Control Center / Raycast
// look, not a see-through one.
export const GLASS_PILL_IDLE = cn(
  "border-slate-200 bg-white text-slate-800 backdrop-saturate-150",
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_16px_-6px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,1)]",
  "hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_12px_22px_-6px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,1)] hover:-translate-y-px",
  "dark:border-white/[0.14] dark:bg-white/[0.09] dark:text-slate-100 dark:backdrop-blur-md",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_8px_18px_-8px_rgba(0,0,0,0.7)]",
  "dark:hover:border-white/[0.22] dark:hover:bg-white/[0.13] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_-8px_rgba(0,0,0,0.75)]",
);

export const GLASS_PILL_FOCUS =
  "focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-zinc-950";

export const GLASS_PILL_ACTIVE =
  "border-blue-300 bg-blue-50 shadow-[0_1px_2px_rgba(37,99,235,0.08),0_8px_16px_-6px_rgba(37,99,235,0.18),inset_0_1px_0_rgba(255,255,255,1)] dark:border-blue-400/50 dark:bg-blue-500/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_8px_18px_-8px_rgba(0,0,0,0.7)]";

export const GLASS_PANEL =
  "border border-slate-200/80 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,1)] backdrop-blur-2xl backdrop-saturate-150 " +
  "dark:border-white/[0.10] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] dark:backdrop-blur-2xl";

interface PillDropdownOption {
  value: string;
  label: string;
  icon?: string;
  invertDark?: boolean;
  description?: string;
  ratio?: string;
}

function RatioIcon({
  ratio,
  className,
}: {
  ratio: string;
  className?: string;
}) {
  const [w, h] = ratio.split(":").map(Number);
  const size = 12;
  const width = w >= h ? size : Math.max(3, Math.round((size * w) / h));
  const height = h >= w ? size : Math.max(3, Math.round((size * h) / w));

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        width,
        height,
        display: "inline-block",
        borderRadius: 2,
        border: "1.5px solid currentColor",
      }}
    />
  );
}

interface PillDropdownProps {
  value: string;
  options: PillDropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  labelPrefix?: string;
  /** Fixed leading icon shown before the value, independent of the selected option (e.g. a clock for duration). */
  icon?: LucideIcon;
  /** Opens the menu above the trigger instead of below -- for pills docked near the bottom of a panel (e.g. a generator modal's control bar) where a downward menu would overflow. */
  openUp?: boolean;
}

export function PillDropdown({
  value,
  options,
  onChange,
  className,
  labelPrefix,
  icon: Icon,
  openUp = false,
}: PillDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = options.find((option) => option.value === value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group",
          GLASS_PILL_BASE,
          GLASS_PILL_IDLE,
          GLASS_PILL_FOCUS,
          open && GLASS_PILL_ACTIVE,
        )}
      >
        {Icon && (
          <Icon className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400" />
        )}
        {current?.icon && (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.06]">
            <Image
              src={current.icon}
              alt=""
              width={11}
              height={11}
              className={cn(
                "h-[11px] w-[11px] shrink-0 object-contain",
                current.invertDark && "dark:invert",
              )}
            />
          </span>
        )}
        {current?.ratio && (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
            <RatioIcon ratio={current.ratio} />
          </span>
        )}
        <span className="whitespace-nowrap tracking-[-0.01em]">
          {labelPrefix && (
            <span className="text-slate-500 dark:text-slate-400">
              {labelPrefix}{" "}
            </span>
          )}
          <span
            className={
              labelPrefix
                ? "font-semibold text-blue-600 dark:text-blue-400"
                : undefined
            }
          >
            {current?.label ?? value}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400",
            open && "rotate-180 text-blue-500 dark:text-blue-400",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute left-0 z-50 max-h-80 w-max min-w-[11rem] overflow-y-auto rounded-2xl p-1.5",
              openUp
                ? "bottom-full mb-2 origin-bottom-left"
                : "top-full mt-2 origin-top-left",
              GLASS_PANEL,
            )}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                    selected
                      ? "bg-blue-500/10 font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/[0.06]",
                  )}
                >
                  {option.icon && (
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1",
                        selected
                          ? "bg-white ring-blue-500/20 dark:bg-zinc-800 dark:ring-blue-400/20"
                          : "bg-slate-100 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.06]",
                      )}
                    >
                      <Image
                        src={option.icon}
                        alt=""
                        width={14}
                        height={14}
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 object-contain",
                          option.invertDark && "dark:invert",
                        )}
                      />
                    </span>
                  )}
                  {option.ratio && (
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center",
                        selected
                          ? "text-blue-500 dark:text-blue-400"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      <RatioIcon ratio={option.ratio} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-nowrap">
                      {option.label}
                    </span>
                    {option.description && (
                      <span
                        className={cn(
                          "block truncate text-xs font-normal",
                          selected
                            ? "text-blue-500/70 dark:text-blue-400/60"
                            : "text-slate-400 dark:text-slate-500",
                        )}
                      >
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
