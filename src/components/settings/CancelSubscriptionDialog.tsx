"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { CANCEL_CONFIRM_LABEL, CANCELLATION_REASONS, type CancellationReason } from "@/lib/cancellation";

// Settings > Subscription > "Cancel subscription" opens this. One plain
// confirmation, no retention offer, no required survey: the reason picker is
// optional and cancelling works without it. The button labels come from
// src/lib/cancellation.ts, which the Refund Policy's steps also quote.

interface CancelSubscriptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelled: () => void;
  /** Formatted end of the paid period, when known ("December 26, 2026"). */
  accessEndsLabel: string | null;
}

export function CancelSubscriptionDialog({ isOpen, onClose, onCancelled, accessEndsLabel }: CancelSubscriptionDialogProps) {
  const [reason, setReason] = useState<CancellationReason | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not cancel your subscription. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      onCancelled();
    } catch {
      setError("Could not cancel your subscription. Please try again.");
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-subscription-title"
        className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="absolute right-4 top-4 text-body hover:text-heading disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="cancel-subscription-title" className="pr-8 text-lg font-semibold text-heading">
          Cancel your subscription?
        </h2>
        <p className="mt-2 text-sm leading-6 text-body">
          {accessEndsLabel
            ? `Your plan stays active with full access until ${accessEndsLabel}. After that it won't renew and you won't be charged again.`
            : "Your plan stays active with full access until the end of the period you've paid for. After that it won't renew and you won't be charged again."}
        </p>

        <label htmlFor="cancel-reason" className="mt-5 block text-sm font-medium text-heading">
          Why are you cancelling? <span className="font-normal text-subtle">(optional)</span>
        </label>
        <select
          id="cancel-reason"
          value={reason}
          disabled={submitting}
          onChange={(event) => setReason(event.target.value as CancellationReason | "")}
          className="mt-1.5 h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <option value="">Prefer not to say</option>
          {CANCELLATION_REASONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm font-medium text-body hover:bg-app disabled:opacity-50"
          >
            Keep subscription
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Cancelling…" : CANCEL_CONFIRM_LABEL}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
