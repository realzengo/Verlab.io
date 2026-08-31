"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PlanDefinition {
  id: string;
  name: string;
  info: string;
  price_monthly: number;
}

export function PlanTab() {
  const [currentPlan, setCurrentPlan] = useState<PlanDefinition | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: profile } = await supabase.from("profiles").select("plan").eq("id", authUser.id).single();

        if (profile?.plan) {
          const { data: planDef } = await supabase
            .from("plan_definitions")
            .select("id, name, info, price_monthly")
            .eq("id", profile.plan)
            .single();
          setCurrentPlan(planDef);
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
          <p className="font-medium text-heading text-sm sm:text-base">Current plan</p>
          <p className="text-body text-xs sm:text-sm mt-0.5">{currentPlan?.info ?? "Your plan and usage at a glance."}</p>
          <p className="mt-2 text-heading text-sm">
            {!loaded ? (
              <Loader2 className="h-4 w-4 animate-spin text-subtle" />
            ) : currentPlan ? (
              <span className="font-semibold">
                {currentPlan.name} · ${currentPlan.price_monthly}/month
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
