"use client";

import { Bookmark, Check, RotateCw, Sparkles, Wand2 } from "lucide-react";
import { useId, type MouseEvent } from "react";
import type { NicheBendCandidate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CreditCost } from "@/components/ui/CreditCost";
import { ProgressiveFluxLoader, type ProgressiveFluxPhase } from "@/components/ui/ProgressiveFluxLoader";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { useFakeStepProgress } from "@/lib/niche-bend/useFakeStepProgress";
import { cn } from "@/lib/utils";

// The SOP is written in two long structured-output passes (hooks/structure,
// then frameworks/retention/reference) that together can take a few minutes —
// these phases give that wait a sense of real, ordered progress. The bar
// tops out at 92% rather than 100 so it never implies completion before the
// real result lands (see useFakeStepProgress).
const SOP_LOADING_PHASES: ProgressiveFluxPhase[] = [
  { at: 0, label: "reviewing your hook style" },
  { at: 23, label: "writing the hook playbook" },
  { at: 46, label: "mapping the script structure" },
  { at: 69, label: "building storytelling frameworks" },
  { at: 92, label: "finalizing retention mechanics" },
];

export function BendCandidateCard({
  candidate,
  selected,
  saved,
  regenerating,
  generatingSop,
  locked,
  onSelect,
  onToggleSaved,
  onRegenerate,
  onUseNow,
}: {
  candidate: NicheBendCandidate;
  selected: boolean;
  saved: boolean;
  regenerating: boolean;
  /** This card's own SOP is being generated — replaces its content with the progress animation. */
  generatingSop: boolean;
  /** Another card's SOP is generating — mutes this card so it can't be interacted with. */
  locked: boolean;
  onSelect: () => void;
  onToggleSaved: () => void;
  onRegenerate: () => void;
  onUseNow: () => void;
}) {
  const busy = regenerating;
  const wandGradientId = useId();

  const phaseIndex = useFakeStepProgress(generatingSop, SOP_LOADING_PHASES.length, {
    minDelayMs: 12_000,
    maxDelayMs: 18_000,
  });
  const sopProgress = (phaseIndex / (SOP_LOADING_PHASES.length - 1)) * 92;

  const stopAndRun = (event: MouseEvent, run: () => void) => {
    event.stopPropagation();
    if (busy || locked) return;
    run();
  };

  return (
    <Card
      padded={false}
      role="button"
      tabIndex={locked ? -1 : 0}
      onClick={() => {
        if (locked) return;
        onSelect();
      }}
      onKeyDown={(event) => {
        if (locked) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative flex cursor-pointer flex-col overflow-hidden outline-none",
        selected && "ring-2 ring-primary",
        locked && "cursor-default opacity-50"
      )}
    >
      {selected && !generatingSop && (
        <span className="absolute right-4 top-4 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-3 w-3" />
        </span>
      )}

      {generatingSop ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-9 text-center">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <span className="absolute h-10 w-10 animate-craft-glow rounded-full bg-primary/50 blur-xl" />
            <svg width="0" height="0" className="absolute" aria-hidden="true">
              <defs>
                <linearGradient id={wandGradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
                </linearGradient>
              </defs>
            </svg>
            <Wand2 className="relative h-5 w-5 animate-pulse" stroke={`url(#${wandGradientId})`} />
          </span>

          <ProgressiveFluxLoader
            phases={SOP_LOADING_PHASES}
            value={sopProgress}
            className="max-w-full gap-4"
            textClassName="text-sm font-bold sm:text-base"
          />

          <p className="text-[11px] text-subtle">This can take a couple of minutes.</p>
        </div>
      ) : (
        <>
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
                  className="flex h-8 items-center gap-1.5 rounded-full bg-btn-primary px-3.5 text-xs font-semibold text-white transition-colors hover:bg-btn-primary-hover"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Get SOP
                  <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.sop} bullet={false} className="text-[11px] font-normal text-white/80" />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
