"use client";

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
      <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={
              activeTab === t.id
                ? "rounded-full bg-[#0b1120] px-4 py-1.5 text-sm font-medium text-white transition-all"
                : "rounded-full bg-transparent px-4 py-1.5 text-sm font-medium text-slate-500 transition-all hover:text-slate-800"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
