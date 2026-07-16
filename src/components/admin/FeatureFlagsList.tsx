"use client";

import { useState } from "react";
import type { FeatureFlag } from "@/lib/types";
import { Switch } from "@/components/ui/Switch";

export function FeatureFlagsList({ flags }: { flags: FeatureFlag[] }) {
  const [state, setState] = useState(flags);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function toggle(flag: FeatureFlag) {
    const nextEnabled = !flag.enabled;
    const nextRolloutPct = nextEnabled ? 100 : 0;

    setState((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled: nextEnabled, rolloutPct: nextRolloutPct } : f)));
    setSavingId(flag.id);

    const res = await fetch("/api/admin/feature-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: flag.id, enabled: nextEnabled, rolloutPct: nextRolloutPct }),
    });

    setSavingId(null);

    if (!res.ok) {
      // Revert on failure.
      setState((prev) => prev.map((f) => (f.id === flag.id ? flag : f)));
    }
  }

  return (
    <div className="flex flex-col divide-y divide-hairline">
      {state.map((flag) => (
        <div key={flag.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-heading">{flag.label}</p>
            <p className="mt-0.5 text-xs text-body">{flag.description}</p>
            <p className="mt-1 text-[11px] font-medium text-subtle">{flag.rolloutPct}% rollout</p>
          </div>
          <Switch
            checked={flag.enabled}
            onChange={() => toggle(flag)}
            disabled={savingId === flag.id}
            label={`Toggle ${flag.label}`}
          />
        </div>
      ))}
    </div>
  );
}
