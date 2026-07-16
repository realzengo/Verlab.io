"use client";

import { useEffect, useState } from "react";
import { Crown, FileText, Gauge, Sparkles, Wallet, Zap } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SettingsCardHeader } from "@/components/settings/SettingsCardHeader";
import { PRICING_PLANS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export function PaymentMethodTab() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
  }, []);

  const planId = user?.user_metadata?.plan as string | undefined;
  const currentPlan = PRICING_PLANS.find((plan) => plan.id === planId);

  return (
    <Card className="max-w-2xl">
      <SettingsCardHeader
        icon={Wallet}
        title="Payment methods"
        description="Your plan, usage, and billing at a glance."
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
        <div className="relative mt-4 overflow-hidden rounded-card-sm bg-gradient-to-br from-[#1c2437] to-ink p-6 text-white shadow-card">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/30 blur-3xl"
          />
          <div className="relative flex items-center justify-between">
            <span className="text-sm text-white/70">Subscription end date</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
              07/27/26
            </span>
          </div>

          <div className="relative mt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold">{currentPlan.name}</p>
                <p className="text-sm text-white/70">{currentPlan.info}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">
                ${currentPlan.price.monthly} <span className="text-sm font-normal text-white/70">/month</span>
              </p>
              <p className="text-sm text-white/70">Renews on 7/27/2026</p>
            </div>
          </div>

          <div className="relative mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Subscription status</span>
              <span className="text-white/70">12 days remaining</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/15">
              <div className="h-1.5 rounded-full bg-gradient-to-r from-primary to-primary-hover" style={{ width: "60%" }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span>Start date: 06/27/26</span>
              <span>End date: 07/27/26</span>
            </div>
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
            <p className="text-sm font-medium text-heading">Transcripts count</p>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-hairline">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-primary to-primary-hover" style={{ width: "57%" }} />
          </div>
          <p className="mt-2 text-sm font-semibold text-heading">57</p>
        </div>
      </div>
    </Card>
  );
}
