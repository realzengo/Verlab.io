"use client";

import { Bookmark, Check, RotateCw, Sparkles } from "lucide-react";
import type { MouseEvent } from "react";
import type { NicheBendCandidate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CreditCost } from "@/components/ui/CreditCost";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { cn } from "@/lib/utils";

export function BendCandidateCard({
  candidate,
  selected,
  saved,
  regenerating,
  submittingSop,
  onSelect,
  onToggleSaved,
  onRegenerate,
  onUseNow,
}: {
  candidate: NicheBendCandidate;
  selected: boolean;
  saved: boolean;
  regenerating: boolean;
  submittingSop: boolean;
  onSelect: () => void;
  onToggleSaved: () => void;
  onRegenerate: () => void;
  onUseNow: () => void;
}) {
  const busy = regenerating || submittingSop;

  const stopAndRun = (event: MouseEvent, run: () => void) => {
    event.stopPropagation();
    if (busy) return;
    run();
  };

  return (
    <Card
      hoverLift
      padded={false}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden outline-none",
        selected && "ring-2 ring-primary"
      )}
    >
      {selected && (
        <span className="absolute right-4 top-4 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-3 w-3" />
        </span>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="pr-6 text-base font-bold text-heading">{candidate.nicheName}</h3>
        <Badge className="w-fit">{candidate.angle}</Badge>
        <ul className="mt-1 flex flex-col gap-2">
          {candidate.exampleTitles.map((title, i) => (
            <li key={i} className="flex gap-1.5 text-sm leading-snug text-body">
              <span className="shrink-0 font-semibold text-primary">→</span>
              {title}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hairline bg-app/60 px-3 py-2.5">
        {busy ? (
          <span className="flex w-full items-center justify-center gap-2 py-0.5 text-xs font-semibold text-primary" role="status">
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute h-4 w-4 animate-craft-glow rounded-full bg-primary/50 blur-[3px]" />
              <Sparkles className="relative h-3.5 w-3.5 animate-pulse" />
            </span>
            Working…
          </span>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="Save"
                onClick={(event) => stopAndRun(event, onToggleSaved)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface text-subtle transition-colors hover:border-primary/30 hover:text-primary",
                  saved && "border-primary/40 bg-accent text-primary"
                )}
              >
                <Bookmark className={cn("h-4 w-4", saved && "fill-primary")} />
                <span className="sr-only">Save</span>
              </button>
              <button
                type="button"
                title={`Regenerate this direction · ${TOOL_CREDIT_COSTS.nicheBend.regenerateCandidate} credits`}
                onClick={(event) => stopAndRun(event, onRegenerate)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 text-subtle transition-colors hover:border-primary/30 hover:text-primary"
              >
                <RotateCw className="h-4 w-4" />
                <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.regenerateCandidate} bullet={false} className="text-[11px] font-semibold" />
              </button>
            </div>

            <button
              type="button"
              title="Generate a full SOP for this direction"
              onClick={(event) => stopAndRun(event, onUseNow)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-btn-primary px-3 text-xs font-semibold text-white shadow-card transition-colors hover:bg-btn-primary-hover"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Get SOP
              <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.sop} bullet={false} className="text-[11px] font-normal text-white/80" />
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
