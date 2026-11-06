"use client";

import { useEffect, useId } from "react";
import { Check, Copy, X } from "lucide-react";
import type { TranscriptRow } from "@/lib/types";
import { Portal } from "@/components/ui/Portal";
import { TranscriptPlatformMark, displayUrl } from "@/components/transcripts/platform";

const SECONDARY_BUTTON =
  "flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-hairline text-sm font-medium text-heading transition-colors duration-150 hover:bg-btn-secondary";
const PRIMARY_BUTTON =
  "flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-btn-primary text-sm font-medium text-white transition-colors duration-150 hover:bg-btn-primary-hover";

// Same layout as the video downloader's popup: title and subtitle, the link
// being worked on, then a progress bar or the next actions.
export function ExtractionDialog({
  row,
  progress,
  copied,
  onCopy,
  onClose,
}: {
  row: TranscriptRow;
  progress: number;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const pending = row.status === "queued" || row.status === "processing";
  const lineCount = row.lines?.length ?? 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 sm:backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-sm rounded-card border border-hairline bg-surface p-6 shadow-[0_24px_48px_-12px_rgba(16,24,40,0.28)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold leading-6 text-heading">
                {pending ? "Extracting transcript" : row.status === "failed" ? "Couldn't extract transcript" : "Transcript ready"}
              </h2>
              <p className="mt-0.5 text-sm leading-5 text-subtle">
                {pending
                  ? "It keeps going if you close this"
                  : row.status === "failed"
                    ? row.error_message || "Try a different link"
                    : `${lineCount} ${lineCount === 1 ? "line" : "lines"}, saved to your history`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-btn-secondary hover:text-heading"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-hairline bg-app px-3 py-2.5">
            <TranscriptPlatformMark platform={row.platform} className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm text-body">{displayUrl(row.source_url)}</span>
            {row.status === "complete" && <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />}
            {row.status === "failed" && <X className="h-4 w-4 shrink-0 text-danger" strokeWidth={1.75} />}
          </div>

          {pending ? (
            <div
              role="progressbar"
              aria-label="Extraction progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-hairline"
            >
              <div
                className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </div>
          ) : row.status === "failed" ? (
            <div className="mt-5 flex">
              <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
                Close
              </button>
            </div>
          ) : (
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onCopy} className={SECONDARY_BUTTON}>
                {copied ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.75} /> : <Copy className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
                View transcript
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
