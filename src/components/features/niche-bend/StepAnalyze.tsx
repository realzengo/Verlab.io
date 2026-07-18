"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ClipboardPaste, Loader2, Wand2 } from "lucide-react";
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

// Steps through the loading phases on its own clock rather than waiting on
// real backend timing: quick at first, then decelerating. The first couple
// of phases land almost instantly (reads as "fast"), then it settles onto
// the final phase and holds there — however long the job actually takes —
// so it never lies about being done before the real result arrives.
const PROGRESS_BASE_DELAY_MS = 380;
const PROGRESS_DELAY_GROWTH = 1.7;

function useFakeStepProgress(active: boolean, stepCount: number): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Scheduling the first step (i=0) through a zero-delay timeout, rather
    // than calling setIndex directly here, keeps the reset out of the
    // effect body itself so it can't trigger a synchronous cascading render.
    const scheduleStep = (i: number, delay: number) => {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setIndex(i);
        if (i < stepCount - 1) {
          scheduleStep(i + 1, PROGRESS_BASE_DELAY_MS * PROGRESS_DELAY_GROWTH ** i);
        }
      }, delay);
    };
    scheduleStep(0, 0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, stepCount]);

  return active ? index : 0;
}

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
  const showValidation = sourceUrl.trim().length > 0 && !detected;
  const canSubmit = Boolean(detected) && analyzeState !== "submitting";
  const phaseIndex = useFakeStepProgress(analyzeState === "polling", LOADING_PHASES.length);

  return (
    <div className="animate-bend-in mx-auto flex max-w-2xl flex-col items-center gap-7 pb-10 pt-4 text-center sm:pt-8">
      <div>
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent">
          <Wand2 className="h-5 w-5 text-primary" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-heading sm:text-4xl">Niche bend it.</h1>
        <p className="mx-auto mt-3 max-w-lg text-body">
          Paste a YouTube or TikTok link — we&apos;ll reverse-engineer the format and hand you three ways to make it
          yours.
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
