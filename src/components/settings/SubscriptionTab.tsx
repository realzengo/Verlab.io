"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";

const PLAN_LABELS: Record<string, string> = { core: "Core", pro: "Pro", scale: "Scale" };

interface SubscriptionTabProps {
  plan: string;
  subscriptionStatus: string | null;
  subscriptionPeriod: string | null;
  currentPeriodEnd: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function SubscriptionTab({ plan, subscriptionStatus, subscriptionPeriod, currentPeriodEnd }: SubscriptionTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whop's own status vocabulary distinguishes "canceling" (cancellation
  // requested, access continues until the period ends) from "canceled"
  // (access has already ended -- see handleMembershipDeactivated, which also
  // reverts `plan` to "core" at that point). Once truly ended there's no
  // active billing left to manage, so it should read exactly like a plain
  // free-tier account rather than showing a stale cancellation date forever.
  const isEnding = subscriptionStatus === "canceling";
  const hasEnded = subscriptionStatus === "canceled" || subscriptionStatus === "expired";
  const hasBilling = subscriptionStatus !== null && !hasEnded;

  useResetOnPageRestore(() => setLoading(false));

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not open billing portal");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal. Please try again.");
      setLoading(false);
    }
  }

  const statusCopy = (() => {
    if (!hasBilling) return `You're on the ${PLAN_LABELS[plan] ?? plan} plan.`;
    if (isEnding && currentPeriodEnd) {
      return `${PLAN_LABELS[plan] ?? plan} (${subscriptionPeriod ?? "monthly"}) — access ends ${formatDate(currentPeriodEnd)}.`;
    }
    if (currentPeriodEnd) {
      return `${PLAN_LABELS[plan] ?? plan} (${subscriptionPeriod ?? "monthly"}), renews on ${formatDate(currentPeriodEnd)}.`;
    }
    return `${PLAN_LABELS[plan] ?? plan} plan.`;
  })();

  return (
    <div>
      <h2 className="font-bold text-lg mb-6 mt-10 first:mt-0 text-heading">Subscription</h2>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-heading text-sm sm:text-base">Manage billing</p>
            {isEnding && (
              <Badge variant="warning">
                <Clock className="h-3 w-3" />
                Ending soon
              </Badge>
            )}
          </div>
          <p className="text-body text-xs sm:text-sm mt-0.5">{statusCopy}</p>
        </div>
        <button
          type="button"
          disabled={!hasBilling || loading}
          onClick={openPortal}
          className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-heading text-app rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:pointer-events-none disabled:opacity-40"
        >
          {loading ? "Opening…" : "Manage subscription"}
        </button>
      </div>

      {hasBilling && !isEnding && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
          <div>
            <p className="font-medium text-heading text-sm sm:text-base">Cancel subscription</p>
            <p className="text-body text-xs sm:text-sm mt-0.5">
              You&apos;ll keep access until the end of the current billing period.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={openPortal}
            className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            Cancel subscription
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-danger">{error}</p>}
    </div>
  );
}
