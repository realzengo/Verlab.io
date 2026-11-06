"use client";

import { Bookmark, Loader2, RotateCw } from "lucide-react";
import type { NicheBendCandidate } from "@/lib/types";
import { INK_BUTTON, MonoChip } from "@/components/brand/BrandKit";
import { CreditCost } from "@/components/ui/CreditCost";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { useFakeStepProgress } from "@/lib/niche-bend/useFakeStepProgress";
import { cn } from "@/lib/utils";

// The SOP is written in two long structured-output passes (hooks/structure,
// then frameworks/retention/reference) that together can take a few minutes —
// these phases give that wait a sense of real, ordered progress. The bar
// tops out at 92% rather than 100 so it never implies completion before the
// real result lands (see useFakeStepProgress).
const SOP_LOADING_PHASES = [
  "Reviewing the hook style",
  "Writing the hook playbook",
  "Mapping the script structure",
  "Building storytelling frameworks",
  "Finalizing retention mechanics",
];

const toolButton =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-hairline bg-white px-3 text-subtle shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors duration-150 hover:bg-[#F7F8FA] hover:text-heading dark:bg-[#1C1C1F] dark:hover:bg-[#232326]";

/** One bend as a column of the choose-step panel, like a step column on the MCP page. */
export function BendCandidateCard({
  candidate,
  saved,
  regenerating,
  generatingSop,
  locked,
  onToggleSaved,
  onRegenerate,
  onUseNow,
}: {
  candidate: NicheBendCandidate;
  saved: boolean;
  regenerating: boolean;
  /** This bend's own SOP is being generated — swaps its titles and actions for the progress. */
  generatingSop: boolean;
  /** Another bend's SOP is generating — mutes this one so it can't be used. */
  locked: boolean;
  onToggleSaved: () => void;
  onRegenerate: () => void;
  onUseNow: () => void;
}) {
  const busy = regenerating || locked;

  const phaseIndex = useFakeStepProgress(generatingSop, SOP_LOADING_PHASES.length, {
    minDelayMs: 12_000,
    maxDelayMs: 18_000,
  });
  const sopProgress = (phaseIndex / (SOP_LOADING_PHASES.length - 1)) * 92;

  return (
    <div
      className={cn(
        "flex flex-col py-8 transition-opacity duration-200 first:pt-0 last:pb-0 lg:px-8 lg:py-0 lg:first:pl-0 lg:last:pr-0",
        locked && "pointer-events-none opacity-40"
      )}
    >
      <div className="flex items-center gap-2.5">
        <MonoChip className={cn(generatingSop && "border-primary/30 text-primary")}>0{candidate.id}</MonoChip>
        <span className="text-[13px] text-subtle">{candidate.angle}</span>
      </div>
      <h3 className="mt-6 min-h-[50px] text-balance text-[19px] font-semibold leading-[25px] tracking-[-0.015em] text-heading">
        {candidate.nicheName}
      </h3>

      {generatingSop ? (
        <div className="mt-4" role="status" aria-live="polite">
          <p className="text-[14.5px] font-medium text-heading">Writing your SOP</p>
          <p className="mt-1 text-[14.5px] text-subtle">{SOP_LOADING_PHASES[phaseIndex]}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-(--app-fill)">
            <div
              className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `scaleX(${Math.max(sopProgress, 6) / 100})` }}
            />
          </div>
          <p className="mt-3 text-[13px] text-subtle">This can take a couple of minutes</p>
        </div>
      ) : (
        <>
          <ul className={cn("mt-4 flex flex-col gap-2.5 transition-opacity duration-200", regenerating && "opacity-40")}>
            {candidate.exampleTitles.map((title, i) => (
              <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-subtle">
                <span aria-hidden className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-subtle/50" />
                {title}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-2 lg:mt-auto lg:pt-8">
            {regenerating ? (
              <span className="inline-flex h-10 items-center gap-2 text-sm text-subtle" role="status">
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating this bend
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onUseNow}
                  title="Generate a full SOP for this bend"
                  className={cn(INK_BUTTON, "h-10 shrink-0 whitespace-nowrap pl-5 pr-4 text-sm")}
                >
                  Get SOP
                  <CreditCost
                    amount={TOOL_CREDIT_COSTS.nicheBend.sop}
                    bullet={false}
                    className="text-xs tabular-nums opacity-60 [&_svg]:h-3 [&_svg]:w-3"
                  />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onToggleSaved}
                  aria-label={saved ? "Saved" : "Save this bend"}
                  aria-pressed={saved}
                  title={saved ? "Saved" : "Save this bend"}
                  className={cn(toolButton, "w-10 px-0", saved && "text-primary hover:text-primary")}
                >
                  <Bookmark className={cn("h-4 w-4", saved && "fill-current")} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRegenerate}
                  aria-label={`Regenerate this bend, ${TOOL_CREDIT_COSTS.nicheBend.regenerateCandidate} credit`}
                  title={`Regenerate this bend · ${TOOL_CREDIT_COSTS.nicheBend.regenerateCandidate} credits`}
                  className={cn(toolButton, "min-w-10 px-0 2xl:px-3")}
                >
                  <RotateCw className="h-4 w-4" strokeWidth={1.75} />
                  {/* Columns are tight beside the sidebar on laptops; the
                      cost stays in the tooltip there and shows on wide screens. */}
                  <CreditCost
                    amount={TOOL_CREDIT_COSTS.nicheBend.regenerateCandidate}
                    bullet={false}
                    className="hidden text-xs tabular-nums 2xl:inline-flex [&_svg]:h-3 [&_svg]:w-3"
                  />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
