"use client";

import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, CircleCheck, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/Portal";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CODE_MAX, isValidCode } from "@/lib/validation";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a promo code is successfully redeemed, e.g. to refresh a displayed balance. */
  onRedeemed?: () => void;
}

export type PackId = "500" | "1000" | "3000" | "10000";
type Badge = { label: string; tone: "primary" | "neutral" };

export const PACKS: { id: PackId; creditsNum: number; priceUsd: number; credits: string; price: string; perK: string; badge?: Badge }[] = [
  { id: "500", creditsNum: 500, priceUsd: 8, credits: "500 Credits", price: "$8.00", perK: "$16.00 / 1,000" },
  { id: "1000", creditsNum: 1000, priceUsd: 15, credits: "1,000 Credits", price: "$15.00", perK: "$15.00 / 1,000" },
  {
    id: "3000",
    creditsNum: 3000,
    priceUsd: 39,
    credits: "3,000 Credits",
    price: "$39.00",
    perK: "$13.00 / 1,000",
    badge: { label: "Most popular", tone: "primary" },
  },
  {
    id: "10000",
    creditsNum: 10000,
    priceUsd: 119,
    credits: "10,000 Credits",
    price: "$119.00",
    perK: "$11.90 / 1,000",
    badge: { label: "Best value", tone: "neutral" },
  },
];

/** "$16.00 / 1,000" -> "$16.00 per 1k" */
export function shortRate(perK: string) {
  return perK.replace(" / 1,000", " per 1k");
}

export function TopUpModal({ isOpen, onClose, onRedeemed }: TopUpModalProps) {
  const [selectedPack, setSelectedPack] = useState<PackId>("3000");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showPromoField, setShowPromoField] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [requiresSubscription, setRequiresSubscription] = useState(false);

  const titleId = useId();

  useResetOnPageRestore(() => setIsCheckingOut(false));

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activePack = PACKS.find((pack) => pack.id === selectedPack) ?? PACKS[0];

  async function handleCheckout() {
    setIsCheckingOut(true);
    setCheckoutError(null);
    setRequiresSubscription(false);
    try {
      const res = await fetch("/api/checkout/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selectedPack }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not start checkout");
        setRequiresSubscription(data.code === "no_active_subscription");
        setIsCheckingOut(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setCheckoutError("Could not start checkout. Please try again.");
      setIsCheckingOut(false);
    }
  }

  async function handleRedeem(event: FormEvent) {
    event.preventDefault();
    if (!promoCode.trim()) return;

    if (!isValidCode(promoCode)) {
      setRedeemError("Enter a valid promo code (letters, numbers, - and _ only).");
      return;
    }

    setRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    try {
      const res = await fetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRedeemError(data.error ?? "Could not redeem promo code");
        return;
      }

      setRedeemSuccess(
        data.rewardType === "credits"
          ? `${data.rewardValue.toLocaleString()} credits added to your balance`
          : `Code redeemed for a ${data.rewardValue}% discount`
      );
      setPromoCode("");
      onRedeemed?.();
    } catch {
      setRedeemError("Could not redeem promo code. Please try again.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-hairline bg-surface shadow-[0_24px_48px_-12px_rgba(16,24,40,0.28)] sm:max-h-[85dvh] sm:rounded-card-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-3 sm:px-6 sm:pt-6">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-xl font-semibold leading-7 tracking-[-0.01em] text-heading">
                Top up credits
              </h2>
              <p className="mt-1 text-sm leading-5 text-subtle">
                Credits never expire while your plan is active.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-btn-secondary hover:text-heading"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div role="radiogroup" aria-label="Credit pack" className="flex flex-col gap-2 px-5 pt-5 sm:px-6">
            {PACKS.map((pack) => {
              const selected = selectedPack === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedPack(pack.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-[background-color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    selected ? "border-primary bg-accent" : "border-hairline bg-surface hover:border-subtle/30 hover:bg-app"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                      selected ? "border-primary bg-primary" : "border-subtle/40 bg-surface"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full bg-white transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium leading-5 tabular-nums text-heading">
                        {pack.creditsNum.toLocaleString()} credits
                      </span>
                      {pack.badge && (
                        <span className="rounded-md bg-btn-secondary px-1.5 py-0.5 text-xs font-medium leading-4 text-body">
                          {pack.badge.label}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 tabular-nums text-subtle">{shortRate(pack.perK)}</span>
                  </span>
                  <span className="text-sm font-semibold leading-5 tabular-nums text-heading">{pack.price}</span>
                </button>
              );
            })}
          </div>

          <div className="px-5 pb-5 pt-4 sm:px-6">
            {redeemSuccess ? (
              <p className="flex items-center gap-2 rounded-lg bg-success-tint px-3 py-2.5 text-sm text-heading">
                <CircleCheck className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />
                {redeemSuccess}
              </p>
            ) : showPromoField ? (
              <div>
                <form onSubmit={handleRedeem} className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    aria-label="Promo code"
                    value={promoCode}
                    maxLength={CODE_MAX}
                    onChange={(event) => {
                      setPromoCode(event.target.value);
                      setRedeemError(null);
                    }}
                    placeholder="Promo code"
                    className={cn(
                      "h-10 min-w-0 flex-1 rounded-lg border bg-surface px-3 text-sm uppercase text-heading outline-none transition-[border-color,box-shadow] duration-150 placeholder:normal-case placeholder:text-subtle focus:ring-2",
                      redeemError
                        ? "border-danger/50 focus:ring-danger/15"
                        : "border-hairline focus:border-primary focus:ring-primary/15"
                    )}
                  />
                  <button
                    type="submit"
                    disabled={redeeming || !promoCode.trim()}
                    className="h-10 shrink-0 rounded-lg border border-hairline bg-btn-secondary px-4 text-sm font-medium text-heading transition-colors duration-150 hover:bg-btn-secondary-hover disabled:pointer-events-none disabled:opacity-50"
                  >
                    {redeeming ? "Applying…" : "Apply"}
                  </button>
                </form>
                {redeemError && <p className="mt-2 text-xs leading-4 text-danger">{redeemError}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPromoField(true)}
                className="inline-flex items-center gap-1 rounded text-sm text-subtle transition-colors duration-150 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Have a promo code?
                <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-hairline px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium leading-5 text-heading">Total</p>
              <p className="text-xs leading-4 tabular-nums text-subtle">
                {activePack.creditsNum.toLocaleString()} credits
              </p>
            </div>
            <span className="text-2xl font-semibold leading-8 tracking-[-0.01em] tabular-nums text-heading">
              {activePack.price}
            </span>
          </div>

          {checkoutError && (
            <p className="mt-4 text-sm leading-5 text-danger">
              {checkoutError}
              {requiresSubscription && (
                <>
                  {" "}
                  <a href="/pricing" className="font-medium underline underline-offset-2">
                    View plans
                  </a>
                </>
              )}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl border border-hairline bg-surface text-sm font-medium text-heading transition-colors duration-150 hover:bg-btn-secondary"
            >
              Cancel
            </button>
            <PlasticButton
              className="h-11 flex-1"
              text="Checkout"
              loading={isCheckingOut}
              loadingText="Processing…"
              onClick={handleCheckout}
              disabled={requiresSubscription}
            />
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs leading-4 text-subtle">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Secure checkout, payments are encrypted
          </p>
        </div>
      </div>
    </div>
    </Portal>
  );
}
