"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LineChart, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChartView } from "./MetricChart";

export interface PeriodOption {
  label: string;
  points?: number;
}

export function ViewToggle({ value, onChange }: { value: ChartView; onChange: (view: ChartView) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-app p-0.5">
      {(["curve", "bar"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            value === v ? "bg-surface text-heading shadow-card" : "text-subtle hover:text-body"
          )}
        >
          {v === "curve" ? <LineChart className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
        </button>
      ))}
    </div>
  );
}

export function PeriodSelect({
  value,
  options,
  onChange,
  accentText,
}: {
  value: string;
  options: PeriodOption[];
  onChange: (option: PeriodOption) => void;
  accentText?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 font-medium text-body hover:text-heading"
        style={accentText ? { color: accentText } : undefined}
      >
        {value}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[150px] rounded-xl border border-hairline bg-surface p-1 shadow-card-hover">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-body hover:bg-accent hover:text-heading",
                opt.label === value && "text-heading"
              )}
            >
              {opt.label}
              {opt.label === value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
