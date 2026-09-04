"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { UpgradeModal } from "@/components/pricing/UpgradeModal";

/** Renders in place of NicheFinder for users with no active subscription -- see
 * requireNicheFinderAccess in src/lib/server/subscription.ts for the server-side
 * enforcement this mirrors. */
export function NicheFinderLocked() {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-hairline bg-surface px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-5 w-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-heading">Niche Finder is a paid feature</h2>
        <p className="max-w-sm text-sm text-subtle">Subscribe to any plan to spot trending niches before they saturate.</p>
      </div>
      <button
        type="button"
        onClick={() => setShowUpgrade(true)}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-hover"
      >
        Upgrade plan
      </button>
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} initialTab="plan" />
    </div>
  );
}
