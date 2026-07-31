"use client";

import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Trash2, X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-body hover:text-heading"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
            danger ? "bg-danger" : "bg-btn-primary"
          )}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>

        <h2 className="mt-4 text-lg font-semibold text-heading">{title}</h2>
        <p className="mt-2 text-sm text-body">{description}</p>

        <div className="mt-6 flex gap-3 border-t border-hairline pt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm font-medium text-body hover:bg-app"
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white",
              danger ? "bg-danger hover:bg-danger/90" : "bg-btn-primary hover:bg-btn-primary-hover"
            )}
          >
            {danger && <Trash2 className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
