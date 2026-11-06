"use client";

import { useMemo, useState } from "react";
import { CreditCost } from "@/components/ui/CreditCost";
import { parseManualVideos } from "@/lib/niche-bend/manual-parse";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import type { NicheBendVideo } from "@/lib/types";
import { FREE_TEXT_MAX } from "@/lib/validation";
import { INK_BUTTON } from "@/components/brand/BrandKit";
import { cn } from "@/lib/utils";

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
        Paste the channel&apos;s top video titles and view counts, one per line, like{" "}
        <span className="text-heading">The mistake that ended a career, 1.2M views</span>
      </p>
      <textarea
        rows={8}
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        aria-label="Video titles and views"
        placeholder={"The mistake that ended a career, 1.2M views\nEvery warning sign nobody caught, 890K views"}
        maxLength={FREE_TEXT_MAX}
        className="w-full rounded-2xl border border-[#E6E8EC] bg-(--app-fill) p-3.5 text-sm leading-6 text-heading outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle focus:border-primary/50 focus:ring-4 focus:ring-primary/10 dark:border-white/[0.07]"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-subtle">
          {parsed.length < 3 ? "Add at least 3 videos" : `${parsed.length} videos ready`}
        </p>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(parsed)}
          className={cn(INK_BUTTON, "h-10 px-5 text-sm")}
        >
          Use these videos
          <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.analyzeManualVideos} className="opacity-70" />
        </button>
      </div>
    </div>
  );
}
