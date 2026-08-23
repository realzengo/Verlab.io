"use client";

import { AlertTriangle, Check, ClipboardPaste, Loader2, Wand2 } from "lucide-react";
import type { NicheBendJobStatus, NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LinkInput } from "@/components/ui/LinkInput";
import { Tabs } from "@/components/ui/Tabs";
import { TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { detectPlatform } from "@/lib/niche-bend/platform";
import { useFakeStepProgress } from "@/lib/niche-bend/useFakeStepProgress";
import { isValidUrl } from "@/lib/validation";
import { BendCandidateSkeleton } from "./BendCandidateSkeleton";
import { ManualPasteFallback } from "./ManualPasteFallback";

const LOADING_PHASES: { status: NicheBendJobStatus; label: string }[] = [
  { status: "opening_channel", label: "Opening channel…" },
  { status: "reading_videos", label: "Reading top 10 videos…" },
  { status: "identifying_format", label: "Identifying the format…" },
  { status: "generating_bends", label: "Generating your niche bends…" },
];

export type AnalyzeState = "idle" | "submitting" | "polling" | "error" | "manual-fallback";

interface StepAnalyzeProps {
  sourceUrl: string;
  onUrlChange: (url: string) => void;
  platform: NicheBendPlatform | null;
  videoType: NicheBendVideoType;
  onVideoTypeChange: (videoType: NicheBendVideoType) => void;
  analyzeState: AnalyzeState;
  errorMessage: string | null;
  onSubmit: () => void;
  onRetry: () => void;
  onShowManualFallback: () => void;
  onManualSubmit: (videos: NicheBendVideo[]) => void;
  manualSubmitting: boolean;
}

export function StepAnalyze({
  sourceUrl,
  onUrlChange,
  platform,
  videoType,
  onVideoTypeChange,
  analyzeState,
  errorMessage,
  onSubmit,
  onRetry,
  onShowManualFallback,
  onManualSubmit,
  manualSubmitting,
}: StepAnalyzeProps) {
  const detected = platform ?? detectPlatform(sourceUrl);
  const trimmedUrl = sourceUrl.trim();
  const urlFormatValid = trimmedUrl.length === 0 || isValidUrl(trimmedUrl);
  const showValidation = trimmedUrl.length > 0 && !detected;
  const showUrlFormatError = trimmedUrl.length > 0 && Boolean(detected) && !urlFormatValid;
  const canSubmit = Boolean(detected) && urlFormatValid && analyzeState !== "submitting";
  const phaseIndex = useFakeStepProgress(analyzeState === "polling", LOADING_PHASES.length);

  return (
    <div className="animate-bend-in relative mx-auto flex max-w-3xl flex-col items-center gap-7 pb-10 pt-4 text-center sm:pt-8">
      <div>
        <span className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-3.5 shadow-card">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#6d93ff] to-primary text-white">
            <Wand2 className="h-2.5 w-2.5" strokeWidth={2.5} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Format Intelligence</span>
        </span>

        <h1 className="text-balance bg-gradient-to-b from-heading to-heading/70 bg-clip-text pb-1 text-4xl font-semibold leading-[1.15] tracking-tighter text-transparent sm:text-5xl lg:text-[3.25rem]">
          Reverse-engineer any{" "}
          <span className="bg-gradient-to-br from-[#6d93ff] to-primary bg-clip-text text-transparent">
            viral format
          </span>
          .
        </h1>
        <p className="mx-auto mt-3.5 max-w-lg text-sm font-semibold leading-relaxed text-body/60">
          Paste a channel link and we&apos;ll break down exactly what&apos;s working, then hand you three fresh ways
          to make it yours.
        </p>
      </div>

      {(analyzeState === "idle" || analyzeState === "submitting" || analyzeState === "error") && (
        <div className="flex w-full flex-col items-center gap-3">
          <LinkInput
            value={sourceUrl}
            onChange={onUrlChange}
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) onSubmit();
            }}
            placeholder="Paste a YouTube or TikTok channel link"
            submitLabel="Analyze Channel →"
            icon={ClipboardPaste}
            loading={analyzeState === "submitting"}
          />

          {showValidation && <p className="text-sm text-danger">Paste a full YouTube or TikTok link.</p>}
          {showUrlFormatError && <p className="text-sm text-danger">That doesn&apos;t look like a valid URL.</p>}

          {detected && (
            <div className="flex items-center gap-3">
              <Badge>
                {detected === "youtube" ? (
                  <YouTubeIcon className="h-3 w-3" />
                ) : (
                  <TikTokIcon className="h-3 w-3" />
                )}
                {detected === "youtube" ? "YouTube" : "TikTok"}
              </Badge>
              {detected === "youtube" && (
                <Tabs
                  items={[
                    { id: "shorts", label: "Shorts" },
                    { id: "long-form", label: "Long-form" },
                  ]}
                  active={videoType}
                  onChange={(id) => onVideoTypeChange(id as NicheBendVideoType)}
                />
              )}
            </div>
          )}

          {analyzeState === "error" && (
            <div className="mt-4 flex w-full flex-col items-center gap-4 rounded-card border border-hairline bg-surface p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-tint">
                <AlertTriangle className="h-5 w-5 text-danger" />
              </span>
              <p className="text-sm text-body">{errorMessage ?? "Something went wrong."}</p>
              <div className="flex items-center gap-3">
                <Button onClick={onRetry}>Try again</Button>
                <Button variant="text" onClick={onShowManualFallback}>
                  Paste videos manually
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {analyzeState === "polling" && (
        <div className="flex w-full flex-col gap-8">
          <div className="flex flex-col gap-3 text-left">
            {LOADING_PHASES.map((phase, i) => {
              const isDone = phaseIndex > i;
              const isCurrent = phaseIndex === i;
              return (
                <div key={phase.status} className="flex items-center gap-3">
                  {isCurrent ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : isDone ? (
                    <Check className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border border-hairline" />
                  )}
                  <span className={isCurrent ? "text-sm font-semibold text-heading" : "text-sm text-body"}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <BendCandidateSkeleton />
            <BendCandidateSkeleton />
            <BendCandidateSkeleton />
          </div>
        </div>
      )}

      {analyzeState === "manual-fallback" && (
        <div className="w-full text-left">
          <ManualPasteFallback onSubmit={onManualSubmit} submitting={manualSubmitting} />
        </div>
      )}
    </div>
  );
}
