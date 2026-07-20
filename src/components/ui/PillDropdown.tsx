"use client";

import { Check, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PillDropdownOption {
  value: string;
  label: string;
  icon?: string;
  invertDark?: boolean;
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
        className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-1px_2px_rgba(0,0,0,0.1)] outline-none transition-all hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-95 dark:bg-zinc-800/80 dark:text-slate-200 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),inset_0_-2px_3px_rgba(0,0,0,0.6)] dark:hover:bg-zinc-700 dark:focus-visible:ring-zinc-600"
      >
        {current?.icon && (
          <Image
            src={current.icon}
            alt=""
            width={16}
            height={16}
            className={cn("h-4 w-4 shrink-0 rounded-full object-contain", current.invertDark && "dark:invert")}
          />
        )}
        <span className="whitespace-nowrap">
          {labelPrefix && <span className="text-slate-800 dark:text-slate-200">{labelPrefix} </span>}
          <span className={labelPrefix ? "text-slate-400 dark:text-slate-500" : undefined}>{current?.label ?? value}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-10 mt-2 max-h-80 w-max min-w-[10rem] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:border-white/5 dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                option.value === value
                  ? "bg-slate-100 font-medium text-slate-900 dark:bg-zinc-800 dark:text-white"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/60"
              )}
            >
              {option.icon && (
                <Image
                  src={option.icon}
                  alt=""
                  width={16}
                  height={16}
                  className={cn("h-4 w-4 shrink-0 rounded-full object-contain", option.invertDark && "dark:invert")}
                />
              )}
              <span className="flex-1 whitespace-nowrap">{option.label}</span>
              {option.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
