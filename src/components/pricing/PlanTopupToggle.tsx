"use client";

import { motion } from "framer-motion";

export type PlanTopupTab = "plan" | "topup";

const TABS: { id: PlanTopupTab; label: string }[] = [
  { id: "plan", label: "Upgrade Plan" },
  { id: "topup", label: "Top-up Credits" },
];

export function PlanTopupToggle({
  activeTab,
  onChange,
}: {
  activeTab: PlanTopupTab;
  onChange: (tab: PlanTopupTab) => void;
}) {
  return (
    <div className="flex w-full justify-center mb-10">
      <div className="inline-flex items-center gap-0.5 rounded-full border border-white/60 bg-white/40 p-1 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className="relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300"
            >
              {active && (
                <motion.span
                  layoutId="plan-topup-pill"
                  transition={{ type: "spring", stiffness: 500, damping: 34, mass: 0.9 }}
                  className="absolute inset-0 rounded-full bg-primary"
                />
              )}
              <span className={active ? "relative text-white" : "relative text-subtle hover:text-heading"}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
