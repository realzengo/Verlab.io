"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { CANCELLATION_REASONS, RETENTION_OFFER_FREE_DAYS, type CancellationReason } from "@/lib/cancellation";
import { cn } from "@/lib/utils";

type Step = "reason" | "reason-detail" | "offer" | "final-feedback" | "confirm" | "retained" | "canceled";

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once the membership is actually scheduled to cancel, so the parent can refresh its status copy. */
  onCanceled: (effectiveDate: string | null) => void;
}

const STEP_ORDER: Step[] = ["reason", "reason-detail", "offer", "final-feedback", "confirm"];

function ProgressBar({ step }: { step: Step }) {
  const index = STEP_ORDER.indexOf(step);
  const pct = index === -1 ? 100 : ((index + 1) / STEP_ORDER.length) * 100;
  return (
    <div className="h-1 w-full overflow-hidden rounded-t-2xl bg-hairline">
      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-start justify-between px-6 pt-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-heading text-sm font-bold text-app">V</span>
        <span className="text-lg font-bold text-heading">Verlab</span>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="text-subtle hover:text-heading">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

const PRIMARY_BTN = "w-full rounded-full bg-btn-primary px-4 py-3 text-sm font-semibold text-white hover:bg-btn-primary-hover transition-colors disabled:pointer-events-none disabled:opacity-50";
const SECONDARY_BTN = "w-full rounded-full border border-hairline bg-surface px-4 py-3 text-sm font-medium text-heading hover:bg-app transition-colors disabled:pointer-events-none disabled:opacity-50";
const DANGER_BTN = "w-full rounded-full border border-danger/30 bg-surface px-4 py-3 text-sm font-semibold text-danger hover:bg-danger-tint transition-colors disabled:pointer-events-none disabled:opacity-50";

export function CancelSubscriptionModal({ isOpen, onClose, onCanceled }: CancelSubscriptionModalProps) {
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [reasonDetail, setReasonDetail] = useState("");
  const [additionalFeedback, setAdditionalFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retainedDays, setRetainedDays] = useState(RETENTION_OFFER_FREE_DAYS);

  function reset() {
    setStep("reason");
    setReason(null);
    setReasonDetail("");
    setAdditionalFeedback("");
    setSubmitting(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function acceptOffer() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, reasonDetail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not extend your subscription.");
      setRetainedDays(data.freeDays ?? RETENTION_OFFER_FREE_DAYS);
      setStep("retained");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCancellation() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, reasonDetail, additionalFeedback, offerShown: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel your subscription.");
      setStep("canceled");
      onCanceled(data.effectiveDate ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <ModalShell onClose={handleClose}>
      {step !== "retained" && step !== "canceled" && <ProgressBar step={step} />}

      {step === "reason" && (
        <div className="p-6">
          <Header onClose={handleClose} />
          <h2 className="mt-5 text-xl font-bold text-heading">Before you go…</h2>
          <p className="mt-1.5 text-sm text-body">Your feedback helps us improve Verlab. What&apos;s the reason you&apos;re canceling?</p>

          <div className="mt-5 flex flex-col gap-2.5">
            {CANCELLATION_REASONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setReason(option.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors",
                  reason === option.id ? "border-primary bg-accent text-heading" : "border-hairline text-heading hover:bg-app"
                )}
              >
                <span
                  className={cn(
                    "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2",
                    reason === option.id ? "border-primary" : "border-hairline"
                  )}
                >
                  {reason === option.id && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                {option.label}
              </button>
            ))}
          </div>

          <button type="button" disabled={!reason} onClick={() => setStep("reason-detail")} className={cn(PRIMARY_BTN, "mt-6")}>
            Continue
          </button>
        </div>
      )}

      {step === "reason-detail" && (
        <div className="p-6">
          <Header onClose={handleClose} />
          <h2 className="mt-5 text-xl font-bold text-heading">What could we have done better?</h2>
          <textarea
            value={reasonDetail}
            onChange={(event) => setReasonDetail(event.target.value)}
            placeholder="Type your answer…"
            rows={4}
            maxLength={2000}
            className="mt-5 w-full resize-none rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-heading placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep("reason")} className={SECONDARY_BTN}>
              Back
            </button>
            <button type="button" onClick={() => setStep("offer")} className={PRIMARY_BTN}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "offer" && (
        <div className="p-6">
          <Header onClose={handleClose} />
          <h2 className="mt-5 text-xl font-bold text-heading">More time to decide</h2>
          <p className="mt-1.5 text-sm text-body">We&apos;ll add {RETENTION_OFFER_FREE_DAYS} free days so you can get more done before deciding.</p>

          <div className="mt-5 rounded-xl bg-accent p-5">
            <p className="text-2xl font-bold text-heading">{RETENTION_OFFER_FREE_DAYS} extra days</p>
            <button type="button" disabled={submitting} onClick={acceptOffer} className={cn(PRIMARY_BTN, "mt-4")}>
              {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `Add ${RETENTION_OFFER_FREE_DAYS} free days`}
            </button>
          </div>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <div className="mt-5 flex gap-3 border-t border-hairline pt-5">
            <button type="button" disabled={submitting} onClick={() => setStep("reason-detail")} className={SECONDARY_BTN}>
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setError(null);
                setStep("final-feedback");
              }}
              className={SECONDARY_BTN}
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {step === "final-feedback" && (
        <div className="p-6">
          <Header onClose={handleClose} />
          <h2 className="mt-5 text-xl font-bold text-heading">Any other thoughts on your experience?</h2>
          <p className="mt-1.5 text-sm text-body">Your honest input is the best way we can improve Verlab.</p>
          <textarea
            value={additionalFeedback}
            onChange={(event) => setAdditionalFeedback(event.target.value)}
            placeholder="Type your answer…"
            rows={4}
            maxLength={2000}
            className="mt-5 w-full resize-none rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-heading placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep("offer")} className={SECONDARY_BTN}>
              Back
            </button>
            <button type="button" onClick={() => setStep("confirm")} className={PRIMARY_BTN}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="p-6">
          <Header onClose={handleClose} />
          <h2 className="mt-5 text-xl font-bold text-heading">Are you 100% sure?</h2>
          <p className="mt-1.5 text-sm text-body">
            If you cancel, you&apos;ll keep access until the end of your current billing period, then lose access to your
            plan, credits, and saved projects.
          </p>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <div className="mt-6 flex flex-col gap-3">
            <button type="button" disabled={submitting} onClick={handleClose} className={PRIMARY_BTN}>
              Never mind, keep my plan
            </button>
            <button type="button" disabled={submitting} onClick={confirmCancellation} className={DANGER_BTN}>
              {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Cancel my subscription"}
            </button>
          </div>
        </div>
      )}

      {step === "retained" && (
        <div className="p-6 text-center">
          <Header onClose={handleClose} />
          <h2 className="mt-5 text-xl font-bold text-heading">You&apos;re all set</h2>
          <p className="mt-1.5 text-sm text-body">
            We&apos;ve added {retainedDays} free days to your plan — no changes to your subscription.
          </p>
          <button type="button" onClick={handleClose} className={cn(PRIMARY_BTN, "mt-6")}>
            Done
          </button>
        </div>
      )}

      {step === "canceled" && (
        <div className="p-6 text-center">
          <Header onClose={handleClose} />
          <h2 className="mt-5 text-xl font-bold text-heading">Subscription canceled</h2>
          <p className="mt-1.5 text-sm text-body">
            Thanks for the feedback — you&apos;ll keep access until the end of your current billing period.
          </p>
          <button type="button" onClick={handleClose} className={cn(PRIMARY_BTN, "mt-6")}>
            Done
          </button>
        </div>
      )}
    </ModalShell>
  );
}
