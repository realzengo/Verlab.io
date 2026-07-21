"use client";

import { Check, Sparkles } from "lucide-react";
import type { NicheBendCandidate, NicheBendChannelAnalysis } from "@/lib/types";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { useFakeStepProgress } from "@/lib/niche-bend/useFakeStepProgress";
import { BendCandidateCard } from "./BendCandidateCard";
import { BendCandidateSkeleton } from "./BendCandidateSkeleton";
import { ChannelAnalysisSummary } from "./ChannelAnalysisSummary";

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

function SopGeneratingStatus() {
  const phaseIndex = useFakeStepProgress(true, SOP_LOADING_PHRASES.length, {
    minDelayMs: 12_000,
    maxDelayMs: 18_000,
  });

  return (
    <span className="inline-flex items-center gap-2.5" role="status">
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="absolute h-4 w-4 animate-craft-glow rounded-full bg-white/70 blur-[3px]" />
        <Sparkles className="relative h-3.5 w-3.5 animate-pulse" />
      </span>
      {SOP_LOADING_PHRASES[phaseIndex]}
    </span>
  );
}

interface StepChooseBendProps {
  analysis: NicheBendChannelAnalysis;
  candidates: NicheBendCandidate[] | null;
  candidatesRegenerating: boolean;
  regeneratingCandidateId: 1 | 2 | 3 | null;
  savedCandidateIds: (1 | 2 | 3)[];
  selectedCandidateId: 1 | 2 | 3 | null;
  onSelect: (id: 1 | 2 | 3) => void;
  onToggleSaved: (id: 1 | 2 | 3) => void;
  onRegenerate: () => void;
  onRegenerateOne: (id: 1 | 2 | 3) => void;
  onGenerateSop: () => void;
  onGenerateSopFor: (id: 1 | 2 | 3) => void;
  sopSubmitting: boolean;
  sopError: string | null;
}

export function StepChooseBend({
  analysis,
  candidates,
  candidatesRegenerating,
  regeneratingCandidateId,
  savedCandidateIds,
  selectedCandidateId,
  onSelect,
  onToggleSaved,
  onRegenerate,
  onRegenerateOne,
  onGenerateSop,
  onGenerateSopFor,
  sopSubmitting,
  sopError,
}: StepChooseBendProps) {
  const selectedCandidate = candidates?.find((candidate) => candidate.id === selectedCandidateId) ?? null;

  return (
    <div className="animate-bend-in flex flex-col gap-8 pb-8">
      <Accordion
        items={[
          {
            id: "original-channel-analysis",
            trigger: `${analysis.channelName} — ${analysis.detectedNiche}`,
            content: <ChannelAnalysisSummary analysis={analysis} />,
          },
        ]}
      />

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-heading">Pick a direction.</h2>
        <Button variant="text" size="sm" onClick={onRegenerate} disabled={candidatesRegenerating}>
          Regenerate bends
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {candidatesRegenerating || !candidates
          ? [0, 1, 2].map((i) => <BendCandidateSkeleton key={i} />)
          : candidates.map((candidate) => (
              <BendCandidateCard
                key={candidate.id}
                candidate={candidate}
                selected={selectedCandidateId === candidate.id}
                saved={savedCandidateIds.includes(candidate.id)}
                regenerating={regeneratingCandidateId === candidate.id}
                submittingSop={selectedCandidateId === candidate.id && sopSubmitting}
                onSelect={() => onSelect(candidate.id)}
                onToggleSaved={() => onToggleSaved(candidate.id)}
                onRegenerate={() => onRegenerateOne(candidate.id)}
                onUseNow={() => onGenerateSopFor(candidate.id)}
              />
            ))}
      </div>

      {!selectedCandidate && sopError && (
        <div className="sticky bottom-0 z-10 border-t border-hairline bg-surface/95 px-4 py-4 shadow-[0_-12px_24px_-16px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="mx-auto max-w-3xl text-sm text-danger">{sopError}</p>
        </div>
      )}

      {selectedCandidate && (
        <div className="sticky bottom-0 z-10 border-t border-hairline bg-surface/95 px-4 py-4 shadow-[0_-12px_24px_-16px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Your direction</p>
                <p className="truncate text-sm font-semibold text-heading">{selectedCandidate.nicheName}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {sopError && <p className="text-sm text-danger">{sopError}</p>}
              <Button
                size="lg"
                className="w-full sm:w-auto"
                icon={sopSubmitting ? undefined : Sparkles}
                iconPosition="right"
                onClick={onGenerateSop}
                disabled={sopSubmitting}
              >
                {sopSubmitting ? <SopGeneratingStatus /> : "Generate my SOP"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
