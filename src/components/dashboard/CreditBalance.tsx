"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

export function CreditBalance() {
  const [credits, setCredits] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/credits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCredits(data.credits);
      })
      .catch(() => {
        // Keep showing the last known balance rather than blanking the pill.
      });
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  if (credits === null) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900">
      <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="text-heading">{credits}</span>
      <Link
        href="/app/settings/subscription"
        className="text-xs font-semibold text-primary hover:underline"
      >
        Buy more
      </Link>
    </div>
  );
}
