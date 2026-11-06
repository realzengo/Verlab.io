"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, RotateCw } from "lucide-react";
import type { NicheBendCandidate, NicheBendChannelAnalysis } from "@/lib/types";
import { BezelPanel, INK_TITLE } from "@/components/brand/BrandKit";
import { CreditCost } from "@/components/ui/CreditCost";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { cn } from "@/lib/utils";
import { BendCandidateCard } from "./BendCandidateCard";
import { BendCandidateSkeleton } from "./BendCandidateSkeleton";
import { ChannelAnalysisSummary } from "./ChannelAnalysisSummary";
import { ChannelAvatar } from "./ChannelAvatar";

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
  onToggleSaved,
  onRegenerate,
  onRegenerateOne,
  onGenerateSopFor,
  sopSubmitting,
  sopError,
}: StepChooseBendProps) {
  const [analysisOpen, setAnalysisOpen] = useState(false);

  return (
    <div className="animate-bend-in flex flex-col items-center pb-8">
      <section className="flex flex-col items-center pt-8 text-center sm:pt-12">
        <h2 className={cn(INK_TITLE, "text-[36px] leading-[1.05] tracking-[-0.04em] sm:text-[48px]")}>
          Pick your bend
        </h2>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-subtle">
          Three new niches for {analysis.channelName}&apos;s format. Get the SOP for the one you want to make.
        </p>
      </section>

      <BezelPanel className="mt-10 w-full sm:mt-12">
        <div className="flex items-center gap-4 border-b border-hairline px-5 py-4 sm:px-8">
          <ChannelAvatar name={analysis.channelName} avatarUrl={analysis.avatarUrl} platform={analysis.platform} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-heading">{analysis.channelName}</p>
            <p className="truncate text-[13px] text-subtle">{analysis.detectedNiche}</p>
          </div>
          <button
            type="button"
            onClick={() => setAnalysisOpen((open) => !open)}
            aria-expanded={analysisOpen}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-(--app-fill) px-3.5 text-[13px] font-medium text-heading transition-colors duration-150 hover:text-heading/80"
          >
            {analysisOpen ? "Hide analysis" : "View analysis"}
            <ChevronDown
              className={cn("h-3.5 w-3.5 text-subtle transition-transform duration-200", analysisOpen && "rotate-180")}
              strokeWidth={2}
            />
          </button>
        </div>

        {analysisOpen && (
          <div className="border-b border-hairline px-5 py-6 sm:px-8">
            <ChannelAnalysisSummary analysis={analysis} hideChannel />
          </div>
        )}

        <div className="grid grid-cols-1 divide-y divide-hairline p-5 sm:p-8 lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:py-10">
          {candidatesRegenerating || !candidates
            ? [0, 1, 2].map((i) => <BendCandidateSkeleton key={i} />)
            : candidates.map((candidate) => (
                <BendCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  saved={savedCandidateIds.includes(candidate.id)}
                  regenerating={regeneratingCandidateId === candidate.id}
                  generatingSop={sopSubmitting && selectedCandidateId === candidate.id}
                  locked={sopSubmitting && selectedCandidateId !== candidate.id}
                  onToggleSaved={() => onToggleSaved(candidate.id)}
                  onRegenerate={() => onRegenerateOne(candidate.id)}
                  onUseNow={() => onGenerateSopFor(candidate.id)}
                />
              ))}
        </div>
      </BezelPanel>

      {sopError && (
        <p className="mt-6 flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {sopError}
        </p>
      )}

      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 text-[13px] text-subtle">
        None of these right?
        <button
          type="button"
          onClick={onRegenerate}
          disabled={candidatesRegenerating || sopSubmitting}
          className="inline-flex items-center gap-1 font-medium text-heading underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          <RotateCw className={cn("h-3.5 w-3.5", candidatesRegenerating && "animate-spin")} strokeWidth={2} />
          Regenerate all three
        </button>
        <CreditCost amount={TOOL_CREDIT_COSTS.nicheBend.analyzeScrape} approx className="tabular-nums [&_svg]:h-3 [&_svg]:w-3" />
      </p>
    </div>
  );
}
