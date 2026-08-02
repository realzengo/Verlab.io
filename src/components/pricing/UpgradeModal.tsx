"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Lock, Minus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlasticButton } from "@/components/ui/plastic-button";
import { PACKS, shortRate, type PackId } from "@/components/TopUpModal";
import { PRICING_PLANS, COMPARISON_ROWS } from "@/lib/mock/pricing";
import type { PricingFrequency, PricingPlan } from "@/lib/types";

type Tab = "plan" | "topup";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "Upgrade Plan" },
  { id: "topup", label: "Top-up Credits" },
];

const FREQUENCIES: PricingFrequency[] = ["monthly", "yearly"];

function maxYearlyPercentOff(plans: PricingPlan[]): number {
  return plans.reduce((max, plan) => {
    if (plan.monthlyOnly || plan.price.monthly === 0) return max;
    const percentOff = Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100);
    return Math.max(max, percentOff);
  }, 0);
}

function goToCheckoutUrl(url: string) {
  window.location.href = url;
}

export function UpgradeModal({
  isOpen,
  onClose,
  initialTab = "plan",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [frequency, setFrequency] = useState<PricingFrequency>("monthly");
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<PackId>("3000");
  const [isCheckingOutPack, setIsCheckingOutPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  // document.body isn't available during SSR -- only portal once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Resets the active tab to initialTab on the closed->open transition.
  // Adjusts state during render (React's documented pattern for this) rather
  // than in an effect, so opening the modal never flashes the previous tab.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setTab(initialTab);
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  async function handleSelectPlan(plan: PricingPlan) {
    setPlanError(null);
    setCheckingOutPlanId(plan.id);
    try {
      const res = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, period: frequency }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setPlanError(data.error ?? "Could not start checkout");
        setCheckingOutPlanId(null);
        return;
      }

      goToCheckoutUrl(data.url);
    } catch {
      setPlanError("Could not start checkout. Please try again.");
      setCheckingOutPlanId(null);
    }
  }

  async function handleCheckoutPack() {
    setPackError(null);
    setIsCheckingOutPack(true);
    try {
      const res = await fetch("/api/checkout/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selectedPack }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setPackError(data.error ?? "Could not start checkout");
        setIsCheckingOutPack(false);
        return;
      }

      goToCheckoutUrl(data.url);
    } catch {
      setPackError("Could not start checkout. Please try again.");
      setIsCheckingOutPack(false);
    }
  }

  const maxPercentOff = maxYearlyPercentOff(PRICING_PLANS);
  const activePack = PACKS.find((pack) => pack.id === selectedPack) ?? PACKS[0];

  // Portaled to <body> so the fixed overlay always covers the full viewport
  // (including the sidebar) -- some pages wrap their content in a
  // positioned, z-indexed container (e.g. AuroraBackground's `relative z-0`
  // root) that would otherwise create a stacking context and trap this
  // modal below sibling elements like the sidebar.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-card-lg border border-hairline bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-app hover:text-heading"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto w-fit rounded-full border border-hairline bg-app p-1">
            <div className="relative flex">
              <span
                className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-heading transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${tab === "topup" ? "100%" : "0%"})` }}
                aria-hidden
              />
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative z-10 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                    tab === t.id ? "text-white" : "text-body hover:text-heading"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
              {tab === "plan" ? "Upgrade your plan" : "Top up your credits"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-body">
              {tab === "plan"
                ? "Move to a higher plan for more monthly credits and features."
                : "Add extra credits any time — they never expire while your plan is active."}
            </p>
          </div>

          {tab === "plan" ? (
            <>
              <div className="relative mx-auto mt-7 flex w-fit items-center gap-3 rounded-full border border-hairline bg-app p-1">
                <span
                  className="absolute inset-y-1 left-1 w-24 rounded-full bg-primary shadow-blue transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(${FREQUENCIES.indexOf(frequency) * 100}%)` }}
                  aria-hidden
                />
                {FREQUENCIES.map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFrequency(freq)}
                    className={cn(
                      "relative z-10 w-24 rounded-full py-1.5 text-sm font-semibold capitalize transition-colors",
                      frequency === freq ? "text-white" : "text-body hover:text-heading"
                    )}
                  >
                    {freq === "yearly" ? "Annual" : "Monthly"}
                  </button>
                ))}
                {maxPercentOff > 0 && (
                  <span className="relative z-10 pr-2 text-xs font-semibold text-success">
                    Save up to {maxPercentOff}%
                  </span>
                )}
              </div>

              {planError && <p className="mt-4 text-center text-sm text-danger">{planError}</p>}

              <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
                {PRICING_PLANS.map((plan) => {
                  const yearlyUnavailable = plan.monthlyOnly && frequency === "yearly";
                  const monthlyEquivalent = Math.round(plan.price.yearly / 12);
                  const price = frequency === "yearly" ? monthlyEquivalent : plan.price.monthly;
                  const percentOff =
                    plan.price.monthly > 0 && !plan.monthlyOnly
                      ? Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100)
                      : 0;

                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        "relative flex flex-col overflow-hidden rounded-2xl border bg-surface",
                        plan.recommended ? "border-primary ring-2 ring-primary/25 shadow-blue" : "border-hairline",
                        yearlyUnavailable && "opacity-50"
                      )}
                    >
                      {plan.recommended && (
                        <div className="flex items-center justify-center gap-1 bg-primary py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                          <Sparkles className="h-3 w-3" />
                          Most Popular
                        </div>
                      )}

                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-base font-semibold text-heading">{plan.name}</h3>

                        {yearlyUnavailable ? (
                          <p className="mt-3 text-sm text-body">Not available on yearly billing</p>
                        ) : (
                          <>
                            <div className="mt-3 flex items-baseline gap-1">
                              <span className="text-3xl font-bold text-heading">${price}</span>
                              <span className="text-sm text-body">/mo</span>
                            </div>
                            {frequency === "yearly" && (
                              <p className="mt-1 text-xs text-body">Billed annually at ${plan.price.yearly}/year</p>
                            )}
                          </>
                        )}
                        {frequency === "yearly" && percentOff > 0 && (
                          <span className="mt-1 text-xs font-semibold text-success">Save {percentOff}%</span>
                        )}

                        <p className="mt-2 text-xs text-subtle">{plan.info}</p>

                        <button
                          type="button"
                          disabled={yearlyUnavailable}
                          onClick={() => handleSelectPlan(plan)}
                          className={cn(
                            "mt-4 w-full rounded-full py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
                            plan.recommended
                              ? "bg-btn-primary text-white hover:bg-btn-primary-hover"
                              : "border border-hairline bg-app text-heading hover:bg-accent"
                          )}
                        >
                          {checkingOutPlanId === plan.id ? "Starting checkout…" : plan.cta}
                        </button>

                        <ul className="mt-5 flex flex-1 flex-col gap-2.5 border-t border-hairline pt-5">
                          {COMPARISON_ROWS.map((row) => {
                            const value = row[plan.id];
                            const included = value !== false;
                            return (
                              <li
                                key={row.feature}
                                className={cn("flex items-start gap-2 text-[13px]", included ? "text-heading" : "text-subtle")}
                              >
                                {included ? (
                                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                ) : (
                                  <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hairline" />
                                )}
                                <span>
                                  {row.feature}
                                  {typeof value === "string" && <span className="text-subtle"> — {value}</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {packError && <p className="mt-4 text-center text-sm text-danger">{packError}</p>}

              <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {PACKS.map((pack) => {
                  const selected = selectedPack === pack.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setSelectedPack(pack.id)}
                      aria-pressed={selected}
                      className={cn(
                        "relative flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all duration-200",
                        selected
                          ? "border-primary/50 bg-accent shadow-[0_8px_20px_-10px_rgba(51,92,255,0.45)] ring-1 ring-primary/20"
                          : "border-hairline bg-app hover:-translate-y-px hover:border-subtle/40 hover:bg-accent/30"
                      )}
                    >
                      {pack.badge && (
                        <span
                          className={cn(
                            "absolute -top-2.5 left-5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                            pack.badge.tone === "primary"
                              ? "bg-primary text-white shadow-[0_4px_12px_-2px_rgba(51,92,255,0.6)]"
                              : "border border-hairline bg-surface text-subtle"
                          )}
                        >
                          {pack.badge.label}
                        </span>
                      )}
                      <div className="flex items-center gap-3.5">
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                            selected ? "border-primary bg-primary" : "border-hairline bg-surface"
                          )}
                        >
                          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                        <div>
                          <span className="text-sm font-semibold text-heading">{pack.credits}</span>
                          <div className="mt-0.5 text-xs text-subtle">{shortRate(pack.perK)}</div>
                        </div>
                      </div>
                      <span className="text-[15px] font-bold tabular-nums text-heading">{pack.price}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mx-auto mt-8 max-w-2xl border-t border-hairline pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-subtle">Total due today</span>
                  <span className="text-lg font-semibold tabular-nums text-heading">{activePack.price}</span>
                </div>
                <PlasticButton
                  className="w-full py-2.5"
                  text={`Get ${activePack.credits}`}
                  loading={isCheckingOutPack}
                  loadingText="Processing…"
                  onClick={handleCheckoutPack}
                />
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-subtle">
                  <Lock className="h-3 w-3" />
                  Secure checkout · Payments are encrypted
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
