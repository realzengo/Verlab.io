"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * Portaled modal frame for the avatar flow. Escape is handled on `window`, so
 * a menu inside the dialog (ComposerMenus' usePopover, on `document`) sees
 * the key first and can claim it with preventDefault.
 */
export function AvatarDialog({
  onClose,
  labelledBy,
  dismissible = true,
  layer = "base",
  className,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  /** False while a dialog stacked on top owns Escape and the backdrop. */
  dismissible?: boolean;
  /** "top" for a dialog opened over the picker. */
  layer?: "base" | "top";
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!dismissible) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismissible, onClose]);

  // False on the server and during hydration, so a dialog rendered on first
  // paint never touches `document` before it exists.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4",
        layer === "top" ? "z-[70]" : "z-[60]"
      )}
      onClick={dismissible ? onClose : undefined}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#131318]",
          className
        )}
      >
        {children}
      </motion.div>
    </div>,
    document.body
  );
}

export function DialogCloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-400/50 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
        className
      )}
    >
      <X className="h-5 w-5" />
    </button>
  );
}

/** Pill-group single choice -- the picker's filters and the save form's tags. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-white/[0.06]", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 whitespace-nowrap rounded-full px-3 text-sm font-medium outline-none transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-blue-400/50",
              active
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-white/[0.14] dark:text-white dark:shadow-none"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
