"use client";

import { AlertCircle } from "lucide-react";
import type { NicheBendCandidate, NicheBendChannelAnalysis } from "@/lib/types";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { CreditCost } from "@/components/ui/CreditCost";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { BendCandidateCard } from "./BendCandidateCard";
import { BendCandidateSkeleton } from "./BendCandidateSkeleton";
import { ChannelAnalysisSummary } from "./ChannelAnalysisSummary";
import { SopGeneratingCard } from "./SopGeneratingCard";

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
            trigger: `${analysis.channelName} for ${analysis.detectedNiche}`,
            content: <ChannelAnalysisSummary analysis={analysis} />,
          },
        ]}
      />

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-heading">Pick a direction.</h2>
        <Button variant="text" size="sm" onClick={onRegenerate} disabled={candidatesRegenerating}>
          Regenerate bends
          <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.analyzeScrape} approx className="text-primary/70" />
        </Button>
      </div>

      {sopSubmitting ? (
        <SopGeneratingCard nicheName={selectedCandidate?.nicheName} />
      ) : (
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
                  onSelect={() => onSelect(candidate.id)}
                  onToggleSaved={() => onToggleSaved(candidate.id)}
                  onRegenerate={() => onRegenerateOne(candidate.id)}
                  onUseNow={() => onGenerateSopFor(candidate.id)}
                />
              ))}
        </div>
      )}

      {sopError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {sopError}
        </div>
      )}
    </div>
  );
}
