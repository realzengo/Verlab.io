"use client";

import { useState } from "react";
import { Check, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlasticButton } from "@/components/ui/plastic-button";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PackId = "500" | "1000" | "3000" | "10000";

const PACKS: { id: PackId; credits: string; price: string; perK: string; badge?: string }[] = [
  { id: "500", credits: "500 Credits", price: "$8.00", perK: "$16.00 / 1,000" },
  { id: "1000", credits: "1,000 Credits", price: "$15.00", perK: "$15.00 / 1,000" },
  { id: "3000", credits: "3,000 Credits", price: "$39.00", perK: "$13.00 / 1,000", badge: "Best Value" },
  { id: "10000", credits: "10,000 Credits", price: "$119.00", perK: "$11.90 / 1,000", badge: "Lowest Rate" },
];

export function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
  const [selectedPack, setSelectedPack] = useState<PackId>("3000");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  if (!isOpen) return null;

  async function handleCheckout() {
    setIsCheckingOut(true);
    try {
      // Wire this up to your actual checkout/payment endpoint.
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-card border border-hairline bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative px-6 pt-7">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-app hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-tint text-warning">
            <Zap className="h-6 w-6" fill="currentColor" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-heading">Top Up Balance</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-body">
            You&apos;ve run out of AI credits. Choose a pack to continue generating content.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 p-6">
          {PACKS.map((pack) => {
            const selected = selectedPack === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPack(pack.id)}
                aria-pressed={selected}
                className={cn(
                  "relative flex w-full items-center justify-between rounded-card-sm border px-4 py-3 text-left transition-all",
                  selected
                    ? "border-primary bg-accent shadow-[0_0_0_1px_var(--color-primary)]"
                    : "border-hairline bg-app hover:border-subtle/40 hover:bg-accent/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      selected ? "border-primary bg-primary" : "border-hairline bg-surface"
                    )}
                  >
                    {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-heading">{pack.credits}</span>
                      {pack.badge && (
                        <span className="rounded-full bg-warning-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                          {pack.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-subtle">{pack.perK}</div>
                  </div>
                </div>
                <span className="shrink-0 font-semibold text-heading">{pack.price}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 border-t border-hairline p-6">
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
      </div>
    </div>
  );
}
