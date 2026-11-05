"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscription-status";
import { fetchPricingPlans } from "@/lib/pricing-plans";
import type { PricingPlan } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsRow, settingsButton } from "@/components/settings/SettingsSection";

/** The "Current plan" row in the Account tab's Plan section. */
export function CurrentPlanRow() {
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
    <SettingsRow
      label={
        <>
          Current plan
          {loaded && isEnding && (
            <Badge variant="warning">
              <Clock className="h-3 w-3" />
              Ending soon
            </Badge>
          )}
        </>
      }
      description={
        !loaded ? (
          <Skeleton className="mt-1 h-3.5 w-32 rounded-full" />
        ) : currentPlan ? (
          <span className="tabular-nums">
            {currentPlan.name} · ${currentPlan.price.monthly}/month
          </span>
        ) : (
          "No active plan"
        )
      }
      control={
        <Link href="/pricing" className={settingsButton(loaded && !currentPlan ? "primary" : "secondary")}>
          {loaded && !currentPlan ? "Choose a plan" : "View plans"}
        </Link>
      }
    />
  );
}
