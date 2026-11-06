"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Link2, Loader2 } from "lucide-react";
import type { NicheBendJobStatus, NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";
import { BezelPanel, INK_BUTTON, INK_TITLE, MonoChip } from "@/components/brand/BrandKit";
import { TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { PlasticButton } from "@/components/ui/plastic-button";
import { detectPlatform } from "@/lib/niche-bend/platform";
import { useFakeStepProgress } from "@/lib/niche-bend/useFakeStepProgress";
import { cn } from "@/lib/utils";
import { isValidUrl } from "@/lib/validation";
import { ManualPasteFallback } from "./ManualPasteFallback";

const LOADING_PHASES: { status: NicheBendJobStatus; label: string }[] = [
  { status: "opening_channel", label: "Opening the channel" },
  { status: "reading_videos", label: "Reading the top 10 videos" },
  { status: "identifying_format", label: "Identifying the format" },
  { status: "generating_bends", label: "Generating your niche bends" },
];

const VIDEO_TYPES: { id: NicheBendVideoType; label: string }[] = [
  { id: "shorts", label: "Shorts" },
  { id: "long-form", label: "Long-form" },
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

// TikTok's note is black; on dark surfaces it takes the white of TikTok's own app icon.
const TIKTOK_ON_DARK = "dark:[&>g>path:last-child]:fill-white";

function PlatformMark({ platform, className }: { platform: NicheBendPlatform; className?: string }) {
  return platform === "youtube" ? (
    <YouTubeIcon className={className} />
  ) : (
    <TikTokIcon className={cn(className, TIKTOK_ON_DARK)} />
  );
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
  const showForm = analyzeState === "idle" || analyzeState === "submitting" || analyzeState === "error";
  // The Analyze button stays in full brand color; pressing it without a
  // usable link explains what's missing instead of the button looking dead.
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const missingLink = attempted && trimmedUrl.length === 0;

  return (
    <div className="animate-bend-in flex flex-col items-center">
      <section className="flex flex-col items-center pt-12 text-center sm:pt-20">
        <h1 className={cn(INK_TITLE, "text-[44px] leading-[1.02] tracking-[-0.045em] sm:text-[64px]")}>
          Niche Bending
        </h1>
        <p className="mt-4 max-w-md text-balance text-base leading-relaxed text-subtle sm:text-[17px]">
          Paste a channel that&apos;s winning. Verlab finds its format and bends it into three new niches for you.
        </p>
      </section>

      <div className="mt-10 w-full max-w-2xl sm:mt-12">
        {showForm && (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) {
                  onSubmit();
                  return;
                }
                setAttempted(true);
                inputRef.current?.focus();
              }}
              className="rounded-[22px] border border-[#EBEDF0] bg-[#F5F6F8] p-1.5 dark:border-white/[0.06] dark:bg-white/[0.025]"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-[#E6E8EC] bg-white py-2 pl-3 pr-2 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-32px_rgba(16,24,40,0.18)] transition-[border-color,box-shadow] duration-150 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 sm:gap-3 sm:pl-4 dark:border-white/[0.07] dark:bg-[#0E0E10]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {detected ? (
                    <PlatformMark platform={detected} className="h-[18px] w-[18px]" />
                  ) : (
                    <Link2 className="h-[18px] w-[18px] text-subtle" strokeWidth={1.75} />
                  )}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={sourceUrl}
                  onChange={(event) => onUrlChange(event.target.value)}
                  placeholder="Paste a channel link"
                  aria-label="Channel link"
                  aria-invalid={missingLink || showValidation || showUrlFormatError}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none placeholder:text-subtle"
                />
                <PlasticButton
                  type="submit"
                  className="h-11 shrink-0"
                  text="Analyze"
                  trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
                  loading={analyzeState === "submitting"}
                  loadingText="Starting"
                />
              </div>
            </form>

            {/* One line under the field so nothing jumps: what's wrong with
                the link, the detected platform with its video type, or which
                platforms work. */}
            <div className="mt-4 flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
              {missingLink ? (
                <p className="text-danger">Paste a YouTube or TikTok channel link first</p>
              ) : showValidation ? (
                <p className="text-danger">Paste a full YouTube or TikTok channel link</p>
              ) : showUrlFormatError ? (
                <p className="text-danger">That doesn&apos;t look like a valid link</p>
              ) : detected ? (
                <>
                  <span className="flex items-center gap-1.5 font-medium text-heading">
                    <PlatformMark platform={detected} className="h-4 w-4" />
                    {detected === "youtube" ? "YouTube channel" : "TikTok channel"}
                  </span>
                  {detected === "youtube" && (
                    <div
                      role="radiogroup"
                      aria-label="Video type"
                      className="inline-flex items-center gap-0.5 rounded-full bg-(--app-fill) p-1"
                    >
                      {VIDEO_TYPES.map((type) => {
                        const active = videoType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onVideoTypeChange(type.id)}
                            className={cn(
                              "h-7 rounded-full px-3 text-[13px] font-medium transition-colors duration-150",
                              active
                                ? "bg-white text-heading shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-[#232326]"
                                : "text-subtle hover:text-heading"
                            )}
                          >
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <span className="flex items-center gap-3 text-subtle">
                  Works with
                  <span className="flex items-center gap-1.5 text-heading">
                    <YouTubeIcon className="h-4 w-4" /> YouTube
                  </span>
                  <span className="flex items-center gap-1.5 text-heading">
                    <TikTokIcon className={cn("h-4 w-4", TIKTOK_ON_DARK)} /> TikTok
                  </span>
                </span>
              )}
            </div>

            {analyzeState === "error" && (
              <div className="mt-4 rounded-2xl border border-danger/20 bg-danger-tint px-5 py-4 text-left">
                <p className="flex items-start gap-2.5 text-[15px] text-heading">
                  <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-danger" strokeWidth={1.75} />
                  {errorMessage ?? "Something went wrong"}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 pl-7">
                  <button type="button" onClick={onRetry} className={cn(INK_BUTTON, "h-10 px-5 text-sm")}>
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={onShowManualFallback}
                    className="text-sm font-medium text-heading underline-offset-4 hover:underline"
                  >
                    Paste videos manually
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {analyzeState === "polling" && (
          <BezelPanel>
            <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
              <p className="min-w-0 truncate text-sm font-medium text-heading">
                Reading {trimmedUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </p>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-subtle">
                Step {Math.min(phaseIndex + 1, LOADING_PHASES.length)} of {LOADING_PHASES.length}
              </span>
            </div>
            <ol className="divide-y divide-hairline" aria-live="polite">
              {LOADING_PHASES.map((phase, i) => {
                const isDone = phaseIndex > i;
                const isCurrent = phaseIndex === i;
                return (
                  <li key={phase.status} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                    <MonoChip className={cn(isCurrent && "border-primary/30 text-primary")}>0{i + 1}</MonoChip>
                    <span
                      className={cn(
                        "flex-1 text-left text-[15px]",
                        isCurrent ? "font-medium text-heading" : isDone ? "text-body" : "text-subtle"
                      )}
                    >
                      {phase.label}
                    </span>
                    {isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : isDone ? (
                      <Check className="h-4 w-4 text-success" strokeWidth={2} />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </BezelPanel>
        )}

        {analyzeState === "manual-fallback" && (
          <BezelPanel innerClassName="p-6 text-left">
            <ManualPasteFallback onSubmit={onManualSubmit} submitting={manualSubmitting} />
          </BezelPanel>
        )}
      </div>
    </div>
  );
}
