"use client";

import { Loader2 } from "lucide-react";
import type { NicheBendCandidate, NicheBendChannelAnalysis } from "@/lib/types";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { BendCandidateCard } from "./BendCandidateCard";
import { BendCandidateSkeleton } from "./BendCandidateSkeleton";
import { ChannelAnalysisSummary } from "./ChannelAnalysisSummary";

interface StepChooseBendProps {
  analysis: NicheBendChannelAnalysis;
  candidates: NicheBendCandidate[] | null;
  candidatesRegenerating: boolean;
  selectedCandidateId: 1 | 2 | 3 | null;
  onSelect: (id: 1 | 2 | 3) => void;
  onRegenerate: () => void;
  onGenerateSop: () => void;
  sopSubmitting: boolean;
  sopError: string | null;
}

export function StepChooseBend({
  analysis,
  candidates,
  candidatesRegenerating,
  selectedCandidateId,
  onSelect,
  onRegenerate,
  onGenerateSop,
  sopSubmitting,
  sopError,
}: StepChooseBendProps) {
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
                onSelect={() => onSelect(candidate.id)}
              />
            ))}
      </div>

      {selectedCandidateId !== null && (
        <div className="sticky bottom-0 z-10 border-t border-hairline bg-surface/95 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-4">
            {sopError && <p className="text-sm text-danger">{sopError}</p>}
            <Button size="lg" className="w-full sm:w-auto" onClick={onGenerateSop} disabled={sopSubmitting}>
              {sopSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate my SOP →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
