"use client";

import { AlertTriangle, Check, ClipboardPaste, Loader2 } from "lucide-react";
import type { NicheBendJobStatus, NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LinkInput } from "@/components/ui/LinkInput";
import { Tabs } from "@/components/ui/Tabs";
import { detectPlatform } from "@/lib/niche-bend/platform";
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
  status: NicheBendJobStatus | null;
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
  status,
  errorMessage,
  onSubmit,
  onRetry,
  onShowManualFallback,
  onManualSubmit,
  manualSubmitting,
}: StepAnalyzeProps) {
  const detected = platform ?? detectPlatform(sourceUrl);
  const showValidation = sourceUrl.trim().length > 0 && !detected;
  const canSubmit = Boolean(detected) && analyzeState !== "submitting";
  const phaseIndex = status ? LOADING_PHASES.findIndex((phase) => phase.status === status) : -1;

  return (
    <div className="animate-bend-in mx-auto flex max-w-2xl flex-col items-center gap-8 py-10 text-center">
      <div>
        <h1 className="text-3xl font-bold text-heading sm:text-4xl">Bend any channel into a new niche.</h1>
        <p className="mt-3 text-body">
          Paste a YouTube or TikTok link. We reverse-engineer the format and hand you 3 ways to make it yours.
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

          {detected && (
            <div className="flex items-center gap-3">
              <Badge>{detected === "youtube" ? "YouTube" : "TikTok"}</Badge>
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
              const isDone = phaseIndex > i || phaseIndex === -1;
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
