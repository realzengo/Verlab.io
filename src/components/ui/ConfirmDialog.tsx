"use client";

import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: LucideIcon;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  icon: Icon = AlertTriangle,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline p-5">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", danger ? "text-danger" : "text-heading")} />
            <h2 className="text-lg font-semibold text-heading">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-body hover:text-heading">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-body">{description}</p>
        </div>

        <div className="flex justify-end gap-3 border-t border-hairline p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-body hover:bg-app"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium text-white",
              danger ? "bg-danger hover:bg-danger/90" : "bg-btn-primary hover:bg-btn-primary-hover"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
