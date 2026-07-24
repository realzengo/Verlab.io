"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CreditCost } from "@/components/ui/CreditCost";
import { parseManualVideos } from "@/lib/niche-bend/manual-parse";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import type { NicheBendVideo } from "@/lib/types";

export function ManualPasteFallback({
  onSubmit,
  submitting,
}: {
  onSubmit: (videos: NicheBendVideo[]) => void;
  submitting: boolean;
}) {
  const [raw, setRaw] = useState("");
  const parsed = useMemo(() => parseManualVideos(raw), [raw]);
  const canSubmit = parsed.length >= 3 && !submitting;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-body">
        Paste your top video titles and view counts, one per line — e.g.{" "}
        <span className="text-heading">The mistake that ended a career — 1.2M views</span>.
      </p>
      <textarea
        rows={10}
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        placeholder={"The mistake that ended a career — 1.2M views\nEvery warning sign nobody caught — 890K views"}
        className="w-full rounded-card-sm border border-hairline bg-surface p-3 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-body">
          {parsed.length < 3 ? "Add at least 3 videos" : `${parsed.length} videos ready`}
        </p>
        <Button size="sm" disabled={!canSubmit} onClick={() => onSubmit(parsed)}>
          Use these videos
          <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.analyzeManualVideos} className="text-white/80" />
        </Button>
      </div>
    </div>
  );
}
