"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PlanDefinition {
  id: string;
  name: string;
  info: string;
  price_monthly: number;
}

export function PaymentMethodTab() {
  const [currentPlan, setCurrentPlan] = useState<PlanDefinition | null>(null);
  const [transcriptsThisMonth, setTranscriptsThisMonth] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const [{ data: profile }, { count }] = await Promise.all([
          supabase.from("profiles").select("plan").eq("id", authUser.id).single(),
          supabase
            .from("transcripts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authUser.id)
            .gte("created_at", new Date(new Date().setDate(1)).toISOString()),
        ]);

        setTranscriptsThisMonth(count ?? 0);

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
      <h2 className="font-bold text-lg mb-6 mt-10 first:mt-0">Plan</h2>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 last:border-0">
        <div>
          <p className="font-medium text-black text-sm sm:text-base">Current plan</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{currentPlan?.info ?? "Your plan and usage at a glance."}</p>
          <p className="mt-2 text-black text-sm">
            {!loaded ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
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
              ? "mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-black transition-colors"
              : "mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          }
        >
          {loaded && !currentPlan ? "Choose a plan" : "View other plans"}
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 last:border-0">
        <div>
          <p className="font-medium text-black text-sm sm:text-base">Daily transcripts</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Included in every plan.</p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center gap-1.5 text-gray-400 text-sm">
          <Lock className="h-3.5 w-3.5" />
          Unlimited
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 last:border-0">
        <div>
          <p className="font-medium text-black text-sm sm:text-base">Transcripts this month</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Resets on the 1st of each month.</p>
        </div>
        <p className="mt-2 sm:mt-0 text-black text-sm font-semibold">{transcriptsThisMonth ?? "—"}</p>
      </div>
    </div>
  );
}
