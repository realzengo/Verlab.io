"use client";

import { useEffect, useState } from "react";
import { Crown, FileText, Gauge, Sparkles, Wallet, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SettingsCardHeader } from "@/components/settings/SettingsCardHeader";
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
    <Card className="max-w-2xl">
      <SettingsCardHeader
        icon={Wallet}
        title="Payment methods"
        description="Your plan and usage at a glance."
      />

      <div className="mt-6 flex items-center justify-between">
        <h3 className="font-semibold text-heading">Current plan</h3>
        <Button variant="secondary" size="sm" icon={Zap} href="/pricing">
          View other plans
        </Button>
      </div>

      {!loaded ? (
        <div className="mt-4 h-40 animate-pulse rounded-card-sm bg-app" />
      ) : !currentPlan ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-card-sm border border-dashed border-hairline bg-app px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="mt-1 text-sm font-semibold text-heading">No active plan</p>
          <p className="max-w-xs text-sm text-body">
            You&apos;re not subscribed to a paid plan yet. Choose one to unlock Pro features.
          </p>
          <Button
            variant="primary"
            size="lg"
            href="/pricing"
            className="mt-3"
            style={{ boxShadow: "none" }}
          >
            Choose a plan
          </Button>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-card-sm border border-hairline bg-surface shadow-card">
          <div className="flex items-center gap-3 p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white">
              <Crown className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-heading">{currentPlan.name}</p>
              <p className="truncate text-sm text-body">{currentPlan.info}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-hairline bg-app px-6 py-4">
            <span className="text-sm text-subtle">Price</span>
            <span className="text-lg font-bold text-heading">
              ${currentPlan.price_monthly} <span className="text-sm font-normal text-subtle">/month</span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-card-sm border border-hairline bg-surface p-4 transition-shadow hover:shadow-card">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
              <Gauge className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-heading">Daily transcripts</p>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-hairline">
            <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-primary to-primary-hover" />
          </div>
          <p className="mt-2 text-sm font-semibold text-heading">Unlimited</p>
        </div>
        <div className="rounded-card-sm border border-hairline bg-surface p-4 transition-shadow hover:shadow-card">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-heading">Transcripts this month</p>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-hairline">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-primary to-primary-hover" style={{ width: "100%" }} />
          </div>
          <p className="mt-2 text-sm font-semibold text-heading">{transcriptsThisMonth ?? "—"}</p>
        </div>
      </div>
    </Card>
  );
}
