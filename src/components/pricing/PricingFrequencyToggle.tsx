"use client";

import type { PricingFrequency } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PricingFrequencyToggle({
  frequency,
  onChange,
  savePercent,
}: {
  frequency: PricingFrequency;
  onChange: (frequency: PricingFrequency) => void;
  /** Shown as a "Save up to X%" pill when set. */
  savePercent?: number;
}) {
  const isYearly = frequency === "yearly";

  return (
    <div className="mb-20 flex justify-center">
      <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={cn(
            "text-sm transition-colors",
            isYearly ? "text-slate-400 hover:text-slate-600" : "font-semibold text-slate-900"
          )}
        >
          Monthly
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={isYearly}
          onClick={() => onChange(isYearly ? "monthly" : "yearly")}
          className={cn(
            "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200",
            isYearly ? "bg-blue-500" : "bg-slate-300"
          )}
        >
          <span
            className={cn(
              "absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isYearly && "translate-x-4"
            )}
          />
        </button>

        <button
          type="button"
          onClick={() => onChange("yearly")}
          className={cn(
            "text-sm transition-colors",
            isYearly ? "font-semibold text-slate-900" : "text-slate-400 hover:text-slate-600"
          )}
        >
          Annual
        </button>

        {savePercent ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
            Save up to {savePercent}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
