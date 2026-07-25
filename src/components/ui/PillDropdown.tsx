"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PillDropdownOption {
  value: string;
  label: string;
  icon?: string;
  invertDark?: boolean;
  description?: string;
  ratio?: string;
}

function RatioIcon({ ratio, className }: { ratio: string; className?: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const size = 14;
  const width = w >= h ? size : Math.max(3, Math.round((size * w) / h));
  const height = h >= w ? size : Math.max(3, Math.round((size * h) / w));

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ width, height, display: "inline-block", borderRadius: 2, border: "1.5px solid currentColor" }}
    />
  );
}

interface PillDropdownProps {
  value: string;
  options: PillDropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  labelPrefix?: string;
}

export function PillDropdown({ value, options, onChange, className, labelPrefix }: PillDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
          "group flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors duration-150 active:scale-[0.97]",
          "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          "dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-white/15 dark:hover:bg-white/[0.07]",
          "focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-zinc-950",
          open && "border-blue-400 bg-blue-50/60 dark:border-blue-400/50 dark:bg-blue-500/10"
        )}
      >
        {current?.icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.06]">
            <Image
              src={current.icon}
              alt=""
              width={13}
              height={13}
              className={cn("h-[13px] w-[13px] shrink-0 object-contain", current.invertDark && "dark:invert")}
            />
          </span>
        )}
        {current?.ratio && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
            <RatioIcon ratio={current.ratio} />
          </span>
        )}
        <span className="whitespace-nowrap tracking-[-0.01em]">
          {labelPrefix && <span className="text-slate-500 dark:text-slate-400">{labelPrefix} </span>}
          <span className={labelPrefix ? "font-semibold text-blue-600 dark:text-blue-400" : undefined}>
            {current?.label ?? value}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500",
            open && "rotate-180 text-blue-500 dark:text-blue-400"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute left-0 top-full z-50 mt-2 max-h-80 w-max min-w-[11rem] origin-top-left overflow-y-auto rounded-2xl p-1.5",
              "border border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl",
              "dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
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
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                    selected
                      ? "bg-blue-500/10 font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                  )}
                >
                  {option.icon && (
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1",
                        selected
                          ? "bg-white ring-blue-500/20 dark:bg-zinc-800 dark:ring-blue-400/20"
                          : "bg-slate-100 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.06]"
                      )}
                    >
                      <Image
                        src={option.icon}
                        alt=""
                        width={14}
                        height={14}
                        className={cn("h-3.5 w-3.5 shrink-0 object-contain", option.invertDark && "dark:invert")}
                      />
                    </span>
                  )}
                  {option.ratio && (
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center",
                        selected ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                      )}
                    >
                      <RatioIcon ratio={option.ratio} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-nowrap">{option.label}</span>
                    {option.description && (
                      <span
                        className={cn(
                          "block truncate text-xs font-normal",
                          selected ? "text-blue-500/70 dark:text-blue-400/60" : "text-slate-400 dark:text-slate-500"
                        )}
                      >
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
