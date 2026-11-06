"use client";

import { useEffect, useId } from "react";
import { Check, Copy, FileText, Link2, PlayCircle, X, XCircle } from "lucide-react";
import type { TranscriptRow } from "@/lib/types";
import { Portal } from "@/components/ui/Portal";
import { cn } from "@/lib/utils";

const PROGRESS_SEGMENTS = 28;

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close" className="text-body hover:text-heading">
      <X className="h-5 w-5" />
    </button>
  );
}

// Extracting (segmented meter), failed, and ready states for the job the
// user just started.
export function ExtractionDialog({
  row,
  progress,
  copied,
  onCopy,
  onClose,
  onViewHistory,
}: {
  row: TranscriptRow;
  progress: number;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
  onViewHistory: () => void;
}) {
  const titleId = useId();
  const pending = row.status === "queued" || row.status === "processing";

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface text-center shadow-card-hover"
          onClick={(event) => event.stopPropagation()}
        >
          {pending ? (
            <div className="p-6 pt-4">
              <div className="flex justify-end">
                <CloseButton onClick={onClose} />
              </div>

              <div className="mx-auto -mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <FileText className="h-8 w-8 text-white" />
              </div>

              <h3 id={titleId} className="mt-4 text-lg font-semibold text-heading">
                Extracting your Transcript...
              </h3>

              <div
                role="progressbar"
                aria-label="Extraction progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="mt-5 flex items-center gap-[3px]"
              >
                {Array.from({ length: PROGRESS_SEGMENTS }).map((_, index) => {
                  const filled = index < Math.round((progress / 100) * PROGRESS_SEGMENTS);
                  return (
                    <span
                      key={index}
                      className={cn(
                        "h-2 flex-1 rounded-full transition-colors duration-300",
                        filled ? "bg-primary" : "bg-hairline"
                      )}
                    />
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-body">
                After completion, view in{" "}
                <button
                  type="button"
                  onClick={onViewHistory}
                  className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                >
                  Transcript History
                  <Link2 className="h-3 w-3" />
                </button>
              </p>
            </div>
          ) : row.status === "failed" ? (
            <div className="p-6 pt-4">
              <div className="flex justify-end">
                <CloseButton onClick={onClose} />
              </div>

              <div className="mx-auto -mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-danger-tint">
                <XCircle className="h-8 w-8 text-danger" />
              </div>

              <h3 id={titleId} className="mt-4 text-lg font-semibold text-heading">
                Extraction failed
              </h3>
              <p className="mt-1 text-sm text-body">
                {row.error_message || "Couldn't extract that transcript. Try a different link."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                <h3 className="text-base font-semibold text-heading">Transcript Ready</h3>
                <CloseButton onClick={onClose} />
              </div>

              <div className="p-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-tint">
                  <Check className="h-8 w-8 text-success" />
                </div>

                <h3 id={titleId} className="mt-4 text-lg font-semibold text-heading">
                  Transcript ready!
                </h3>
                <p className="mt-1 text-sm text-body">Your transcript has been processed successfully</p>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={onCopy}
                    className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-hairline px-2 py-3 text-sm font-semibold text-heading hover:bg-app"
                  >
                    {copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-btn-primary px-2 py-3 text-sm font-semibold text-white hover:bg-btn-primary-hover"
                  >
                    <PlayCircle className="h-4 w-4 shrink-0" />
                    View Transcript
                  </button>
                </div>

                <p className="mt-4 text-xs text-body">
                  View all in{" "}
                  <button
                    type="button"
                    onClick={onViewHistory}
                    className="font-medium text-primary hover:underline"
                  >
                    Transcript History
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
