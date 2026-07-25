"use client";

import { Sparkles } from "lucide-react";
import { useFakeStepProgress } from "@/lib/niche-bend/useFakeStepProgress";

// The SOP is written in two long structured-output passes (hooks/structure,
// then frameworks/retention/reference) that together can take a few minutes
// — these phrases give that wait a sense of real, ordered progress instead of
// a single static "Generating…" label sitting there unchanged the whole time.
const SOP_LOADING_PHRASES = [
  "Reviewing your hook style…",
  "Writing the hook playbook…",
  "Mapping the script structure…",
  "Building storytelling frameworks…",
  "Finalizing retention mechanics…",
];

export function SopGeneratingModal({ open, nicheName }: { open: boolean; nicheName?: string }) {
  const phaseIndex = useFakeStepProgress(open, SOP_LOADING_PHRASES.length, {
    minDelayMs: 12_000,
    maxDelayMs: 18_000,
  });

  if (!open) return null;

  return (
    <div
      className="animate-bend-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Generating your SOP"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-card border border-hairline bg-surface p-8 text-center shadow-card-hover">
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <span className="absolute h-12 w-12 animate-craft-glow rounded-full bg-primary/40 blur-xl" />
          <Sparkles className="relative h-6 w-6 animate-pulse text-primary" />
        </span>

        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-heading">Generating your SOP</h3>
          {nicheName && <p className="text-sm text-body">for {nicheName}</p>}
        </div>

        <div className="flex w-full flex-col gap-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${((phaseIndex + 1) / SOP_LOADING_PHRASES.length) * 100}%` }}
            />
          </div>
          <p className="text-xs font-semibold text-primary" role="status">
            {SOP_LOADING_PHRASES[phaseIndex]}
          </p>
        </div>

        <p className="text-[11px] text-subtle">This can take a couple of minutes — feel free to wait, it&rsquo;ll land here.</p>
      </div>
    </div>
  );
}
