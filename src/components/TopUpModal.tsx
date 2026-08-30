"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Check, ChevronRight, Lock, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
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
    badge: { label: "Most Popular", tone: "primary" },
  },
  {
    id: "10000",
    creditsNum: 10000,
    priceUsd: 119,
    credits: "10,000 Credits",
    price: "$119.00",
    perK: "$11.90 / 1,000",
    badge: { label: "Best Value", tone: "neutral" },
  },
];

/** "$16.00 / 1,000" -> "$16.00/1k" */
export function shortRate(perK: string) {
  return perK.replace(" / 1,000", "/1k");
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

  useResetOnPageRestore(() => setIsCheckingOut(false));

  if (!isOpen) return null;

  const activePack = PACKS.find((pack) => pack.id === selectedPack) ?? PACKS[0];

  async function handleCheckout() {
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selectedPack }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not start checkout");
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
          ? `${data.rewardValue.toLocaleString()} credits added to your balance!`
          : `${data.rewardValue}% discount unlocked!`
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-hairline bg-surface shadow-card-hover sm:max-h-[85dvh] sm:rounded-card-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 0%, var(--color-accent) 0%, transparent 70%)",
          }}
        />

        <div className="relative shrink-0 px-5 pt-5 sm:px-7 sm:pt-7">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-hairline sm:hidden" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-app hover:text-heading sm:right-5 sm:top-5"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_8px_20px_-6px_rgba(51,92,255,0.65)]"
            style={{ background: "linear-gradient(140deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 55%, #7c3aed))" }}
          >
            <Zap className="h-5 w-5" fill="currentColor" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight text-heading sm:text-[22px]">
            Top Up Balance
          </h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-body">
            You&apos;ve run out of AI credits. Choose a pack to continue generating content.
          </p>
        </div>

        <div className="relative flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2.5 px-5 pb-2 pt-6 sm:px-7 sm:pt-7">
          {PACKS.map((pack) => {
            const selected = selectedPack === pack.id;
            const featured = pack.badge?.tone === "primary";
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPack(pack.id)}
                aria-pressed={selected}
                className={cn(
                  "relative flex w-full items-center justify-between rounded-2xl border text-left transition-all duration-200",
                  featured ? "px-5 py-4" : "px-5 py-3.5",
                  selected && featured &&
                    "border-transparent bg-gradient-to-br from-primary/15 via-accent to-accent/60 shadow-[0_16px_36px_-12px_rgba(51,92,255,0.55)] ring-2 ring-primary/60",
                  selected && !featured &&
                    "border-primary/50 bg-accent shadow-[0_8px_20px_-10px_rgba(51,92,255,0.45)] ring-1 ring-primary/20",
                  !selected &&
                    "border-hairline bg-app hover:-translate-y-px hover:border-subtle/40 hover:bg-accent/30 hover:shadow-sm"
                )}
              >
                {featured && (
                  <span className="absolute -top-2.5 left-5 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-[0_4px_12px_-2px_rgba(51,92,255,0.6)]">
                    <Sparkles className="h-2.5 w-2.5" />
                    {pack.badge!.label}
                  </span>
                )}
                <div className="flex min-w-0 items-center gap-3.5">
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                      featured ? "h-[22px] w-[22px]" : "h-5 w-5",
                      selected ? "border-primary bg-primary shadow-[0_0_0_3px_rgba(51,92,255,0.15)]" : "border-hairline bg-surface"
                    )}
                  >
                    {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold text-heading", featured ? "text-[16px]" : "text-[14px]")}>
                        {pack.credits}
                      </span>
                      {pack.badge && !featured && (
                        <span className="shrink-0 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-subtle">
                          {pack.badge.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-subtle">{shortRate(pack.perK)}</div>
                  </div>
                </div>
                <span className={cn("shrink-0 font-bold tabular-nums text-heading", featured ? "text-xl" : "text-[15px]")}>
                  {pack.price}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative border-t border-hairline px-5 py-4 sm:px-7">
          {redeemSuccess ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/[0.07] px-4 py-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15">
                <Check className="h-3 w-3 text-success" strokeWidth={3} />
              </span>
              <p className="text-[13px] font-medium leading-snug text-heading">{redeemSuccess}</p>
            </div>
          ) : showPromoField ? (
            <div>
              <p className="mb-2 text-xs font-medium text-subtle">Have a code?</p>
              <form onSubmit={handleRedeem} className="flex items-stretch gap-2">
                <input
                  autoFocus
                  type="text"
                  value={promoCode}
                  maxLength={CODE_MAX}
                  onChange={(event) => {
                    setPromoCode(event.target.value);
                    setRedeemError(null);
                  }}
                  placeholder="Enter code"
                  className={cn(
                    "min-w-0 flex-1 rounded-lg border bg-app px-3.5 py-2.5 text-sm uppercase tracking-wide text-heading outline-none transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-subtle",
                    redeemError ? "border-danger/40 focus:border-danger/60" : "border-hairline focus:border-primary/50"
                  )}
                />
                <button
                  type="submit"
                  disabled={redeeming || !promoCode.trim()}
                  className="shrink-0 rounded-lg border border-hairline bg-surface px-4 text-xs font-semibold text-heading transition-colors hover:border-subtle/40 hover:bg-app disabled:pointer-events-none disabled:opacity-40"
                >
                  {redeeming ? "Applying…" : "Apply"}
                </button>
              </form>
              {redeemError && <p className="mt-2 text-xs text-danger">{redeemError}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPromoField(true)}
              className="group flex w-full items-center justify-between text-left"
            >
              <span className="text-[13px] font-medium text-subtle transition-colors group-hover:text-heading">
                Have a promo code?
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-subtle transition-colors group-hover:text-heading" />
            </button>
          )}
        </div>
        </div>

        <div className="relative shrink-0 border-t border-hairline bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7 sm:pt-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-subtle">Total due today</span>
            <span className="text-lg font-semibold tabular-nums text-heading">{activePack.price}</span>
          </div>

          {checkoutError && <p className="mb-3 text-xs text-danger">{checkoutError}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-hairline bg-transparent py-2.5 text-sm font-medium text-heading transition-colors hover:bg-app"
            >
              Cancel
            </button>
            <PlasticButton
              className="flex-1 py-2.5"
              text="Checkout"
              loading={isCheckingOut}
              loadingText="Processing…"
              onClick={handleCheckout}
            />
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-subtle">
            <Lock className="h-3 w-3" />
            Secure checkout · Payments are encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
