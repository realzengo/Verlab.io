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
      <div className="inline-flex items-center rounded-full border border-hairline bg-surface p-0.5 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={
              activeTab === t.id
                ? "rounded-full bg-heading px-4 py-1.5 text-sm font-medium text-background transition-all"
                : "rounded-full bg-transparent px-4 py-1.5 text-sm font-medium text-subtle transition-all hover:text-heading"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
