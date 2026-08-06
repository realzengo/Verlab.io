"use client";

import { motion } from "framer-motion";
import type { PricingFrequency } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PricingFrequencyToggle({
  frequency,
  onChange,
  savePercent,
}: {
  frequency: PricingFrequency;
  onChange: (frequency: PricingFrequency) => void;
  /** Shown as a "Save X%" pill next to the Yearly label when set. */
  savePercent?: number;
}) {
  return (
    <div className="flex justify-center">
      <div className="relative z-10 mx-auto flex w-fit rounded-full border border-hairline bg-app p-1">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={cn(
            "relative z-10 h-10 w-fit rounded-full px-3 py-1 font-medium transition-colors sm:h-12 sm:px-6 sm:py-2",
            frequency === "monthly" ? "text-white" : "text-subtle hover:text-heading"
          )}
        >
          {frequency === "monthly" && (
            <motion.span
              layoutId="pricing-frequency-pill"
              className="absolute left-0 top-0 h-10 w-full rounded-full border-4 border-blue-600 bg-gradient-to-t from-blue-500 via-blue-400 to-blue-600 shadow-sm shadow-blue-600 sm:h-12"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>

        <button
          type="button"
          onClick={() => onChange("yearly")}
          className={cn(
            "relative z-10 h-10 w-fit shrink-0 rounded-full px-3 py-1 font-medium transition-colors sm:h-12 sm:px-6 sm:py-2",
            frequency === "yearly" ? "text-white" : "text-subtle hover:text-heading"
          )}
        >
          {frequency === "yearly" && (
            <motion.span
              layoutId="pricing-frequency-pill"
              className="absolute left-0 top-0 h-10 w-full rounded-full border-4 border-blue-600 bg-gradient-to-t from-blue-500 via-blue-400 to-blue-600 shadow-sm shadow-blue-600 sm:h-12"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Yearly
            {savePercent ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-black">
                Save {savePercent}%
              </span>
            ) : null}
          </span>
        </button>
      </div>
    </div>
  );
}
