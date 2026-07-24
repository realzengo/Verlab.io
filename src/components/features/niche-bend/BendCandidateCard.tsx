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
        "group relative flex cursor-pointer flex-col gap-3 outline-none",
        selected && "ring-2 ring-primary"
      )}
    >
      {selected && (
        <span className="absolute right-4 top-4 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-3 w-3" />
        </span>
      )}

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

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center gap-3 rounded-card bg-surface/75 opacity-0 backdrop-blur-sm transition-opacity duration-150",
          busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        )}
      >
        {busy ? (
          <span className="relative flex h-9 w-9 items-center justify-center" role="status">
            <span className="absolute h-8 w-8 animate-craft-glow rounded-full bg-primary/50 blur-lg" />
            <Sparkles className="relative h-5 w-5 animate-pulse text-primary" />
            <span className="sr-only">Working…</span>
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={(event) => stopAndRun(event, onToggleSaved)}
              className="flex flex-col items-center gap-1.5 text-xs font-semibold text-heading"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface shadow-card transition-colors",
                  saved && "border-primary bg-accent text-primary"
                )}
              >
                <Bookmark className={cn("h-4 w-4", saved && "fill-primary")} />
              </span>
              Save
            </button>
            <button
              type="button"
              onClick={(event) => stopAndRun(event, onRegenerate)}
              className="flex flex-col items-center gap-1.5 text-xs font-semibold text-heading"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface shadow-card">
                <RotateCw className="h-4 w-4" />
              </span>
              Regenerate
              <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.regenerateCandidate} bullet={false} className="font-normal text-subtle" />
            </button>
            <button
              type="button"
              onClick={(event) => stopAndRun(event, onUseNow)}
              className="flex flex-col items-center gap-1.5 text-xs font-semibold text-heading"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary bg-primary text-white shadow-card">
                <Sparkles className="h-4 w-4" />
              </span>
              Get SOP
              <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.sop} bullet={false} className="font-normal text-subtle" />
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
