"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/transcript-export";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  onExport?: (format: ExportFormat) => void;
}

export function ExportModal({ isOpen, onClose, count, onExport }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("CSV");

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 flex w-full max-w-md flex-col rounded-xl bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline p-5">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-heading" />
            <h2 className="text-lg font-semibold text-heading">Choose Export Format</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-body hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-body">Exporting {count} transcripts</p>
          <p className="mb-2 mt-4 text-sm font-medium text-heading">Select Format:</p>

          <div className="flex flex-col gap-2">
            {EXPORT_FORMATS.map((format) => {
              const isActive = format.id === selectedFormat;
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setSelectedFormat(format.id)}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? "flex w-full cursor-pointer items-start gap-3 rounded-lg border-2 border-primary bg-accent p-4 text-left"
                      : "flex w-full cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-surface p-4 text-left hover:border-primary/40"
                  }
                >
                  <span
                    className={
                      isActive
                        ? "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-4 border-primary bg-surface"
                        : "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-hairline"
                    }
                  />
                  <span>
                    <span className="block font-semibold text-heading">{format.title}</span>
                    <span className="block text-sm text-body">{format.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-hairline p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-4 py-2 text-body hover:bg-app"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-btn-primary px-4 py-2 text-white hover:bg-btn-primary-hover"
          >
            Export as {selectedFormat}
          </button>
        </div>
      </div>
    </div>
  );
}
