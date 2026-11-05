"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscription-status";
import { fetchPricingPlans } from "@/lib/pricing-plans";
import type { PricingPlan } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

export function PlanTab() {
  const [currentPlan, setCurrentPlan] = useState<PricingPlan | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscription_status, subscription_current_period_end")
          .eq("id", authUser.id)
          .single();

        // "canceling" is Whop's status for "cancellation requested, access
        // continues until the period ends" -- see the same distinction in
        // SubscriptionTab.tsx.
        setIsEnding(profile?.subscription_status === "canceling");

        // `profile.plan` alone isn't enough -- it can still hold the last
        // plan id after a subscription lapses. Gate on the same
        // hasActiveSubscription() the /app paywall itself uses (proxy.ts),
        // so this never shows a plan the paywall would disagree with.
        if (profile?.plan && hasActiveSubscription(profile)) {
          const plans = await fetchPricingPlans();
          setCurrentPlan(plans?.find((plan) => plan.id === profile.plan) ?? null);
        }
      }

      setLoaded(true);
    }

    load();
  }, []);

  return (
    <div>
      <h2 className="font-bold text-lg mb-6 mt-10 first:mt-0 text-heading">Plan</h2>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-heading text-sm sm:text-base">Current plan</p>
            {loaded && isEnding && (
              <Badge variant="warning">
                <Clock className="h-3 w-3" />
                Ending soon
              </Badge>
            )}
          </div>
          <p className="text-body text-xs sm:text-sm mt-0.5">{currentPlan?.info ?? "Your plan and usage at a glance."}</p>
          <p className="mt-2 text-heading text-sm">
            {!loaded ? (
              <Loader2 className="h-4 w-4 animate-spin text-subtle" />
            ) : currentPlan ? (
              <span className="font-semibold">
                {currentPlan.name} · ${currentPlan.price.monthly}/month
              </span>
            ) : (
              "No active plan"
            )}
          </p>
        </div>
        <Link
          href="/pricing"
          className={
            loaded && !currentPlan
              ? "mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-heading text-app rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              : "mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
          }
        >
          {loaded && !currentPlan ? "Choose a plan" : "View other plans"}
        </Link>
      </div>
    </div>
  );
}
