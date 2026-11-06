"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/transcript-export";
import { cn } from "@/lib/utils";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  onExport?: (format: ExportFormat) => void;
}

export function ExportModal({ isOpen, onClose, count, onExport }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("CSV");
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport?.(selectedFormat);
    onClose();
  };

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
          className="w-full max-w-md rounded-card border border-hairline bg-surface p-6 shadow-[0_24px_48px_-12px_rgba(16,24,40,0.28)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold leading-6 text-heading">
                Export transcripts
              </h2>
              <p className="mt-0.5 text-sm leading-5 text-subtle">
                All {count} {count === 1 ? "transcript" : "transcripts"} in one file
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

          <div role="radiogroup" aria-label="Format" className="mt-5 flex flex-col gap-2">
            {EXPORT_FORMATS.map((format) => {
              const selected = format.id === selectedFormat;
              return (
                <button
                  key={format.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedFormat(format.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    selected ? "border-primary bg-accent" : "border-hairline bg-surface hover:border-subtle/30 hover:bg-app"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                      selected ? "border-primary bg-primary" : "border-subtle/40 bg-surface"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full bg-white transition-[transform,opacity] duration-150",
                        selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                      )}
                    />
                  </span>
                  <span className="w-11 shrink-0 font-mono text-[12px] font-medium text-heading">.{format.id.toLowerCase()}</span>
                  <span className="min-w-0 text-sm text-subtle">{format.description}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 flex-1 items-center justify-center rounded-lg border border-hairline text-sm font-medium text-heading transition-colors duration-150 hover:bg-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={count === 0}
              className="flex h-10 flex-1 items-center justify-center rounded-lg bg-btn-primary text-sm font-medium text-white transition-colors duration-150 hover:bg-btn-primary-hover disabled:opacity-50"
            >
              Export .{selectedFormat.toLowerCase()}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
