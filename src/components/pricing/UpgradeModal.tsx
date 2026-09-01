"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PricingCard } from "@/components/pricing/PricingCard";
import { PricingFrequencyToggle } from "@/components/pricing/PricingFrequencyToggle";
import { PlanTopupToggle, type PlanTopupTab } from "@/components/pricing/PlanTopupToggle";
import { CreditTopupPanel } from "@/components/pricing/CreditTopupPanel";
import type { PackId } from "@/components/TopUpModal";
import { createClient } from "@/lib/supabase/client";
import { PRICING_PLANS } from "@/lib/mock/pricing";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";
import { cn } from "@/lib/utils";

type Tab = PlanTopupTab;

// Mirrors planRowToPricingPlan in src/lib/server/admin-queries.ts, which
// can't be imported here -- it pulls in the service-role Supabase client,
// which must never reach a client bundle. plan_definitions has a public-read
// RLS policy, so the browser client can query it directly instead.
// PLAN_DEFINITION_SELECT mirrors admin-queries.ts's column list too -- the
// table also has `updated_at`, which nothing here renders.
const PLAN_DEFINITION_SELECT = "id, name, info, price_monthly, price_yearly, recommended, monthly_only, cta, features, limits, sort_order";

interface PlanDefinitionRow {
  id: string;
  name: string;
  info: string;
  price_monthly: number;
  price_yearly: number;
  recommended: boolean;
  monthly_only: boolean;
  cta: string;
  features: { text: string; tooltip?: string }[];
  limits: string | null;
}

function planRowToPricingPlan(row: PlanDefinitionRow): PricingPlan {
  return {
    id: row.id as PricingPlan["id"],
    name: row.name,
    info: row.info,
    price: { monthly: row.price_monthly, yearly: row.price_yearly },
    recommended: row.recommended || undefined,
    monthlyOnly: row.monthly_only || undefined,
    cta: row.cta,
    features: row.features,
    limits: row.limits ?? undefined,
  };
}

function goToCheckoutUrl(url: string) {
  window.location.href = url;
}

function maxYearlyPercentOff(plans: PricingPlan[]): number {
  return plans.reduce((max, plan) => {
    if (plan.monthlyOnly || plan.price.monthly === 0) return max;
    const percentOff = Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100);
    return Math.max(max, percentOff);
  }, 0);
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
  const [plans, setPlans] = useState<PricingPlan[]>(PRICING_PLANS);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<PricingFrequency>("yearly");
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [checkingOutTopupId, setCheckingOutTopupId] = useState<PackId | null>(null);
  const [packError, setPackError] = useState<string | null>(null);

  useResetOnPageRestore(() => {
    setCheckingOutPlanId(null);
    setCheckingOutTopupId(null);
  });

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

  // Re-fetches live, admin-editable pricing every time the modal opens --
  // PRICING_PLANS is a stale fallback only (see the plan_definitions
  // migration comment: it's meant to replace that mock, not run alongside
  // it indefinitely).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const [{ data }, profileResult] = await Promise.all([
        supabase.from("plan_definitions").select(PLAN_DEFINITION_SELECT).order("sort_order"),
        authUser
          ? supabase.from("profiles").select("plan, subscription_status").eq("id", authUser.id).single()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      if (data && data.length > 0) {
        setPlans((data as PlanDefinitionRow[]).map(planRowToPricingPlan));
      }
      setCurrentPlanId(profileResult.data?.plan ?? null);
      setSubscriptionStatus(profileResult.data?.subscription_status ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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

  async function handleCheckoutPack(packId: PackId) {
    setPackError(null);
    setCheckingOutTopupId(packId);
    try {
      const res = await fetch("/api/checkout/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        // No plan to attach extra credits to -- send them to the plan tab
        // instead of leaving them stuck on a topup pack they can't buy.
        // planError (not packError) since that's the tab now on screen.
        if (data.code === "no_active_subscription") {
          setTab("plan");
          setPlanError(data.error ?? "Could not start checkout");
        } else {
          setPackError(data.error ?? "Could not start checkout");
        }
        setCheckingOutTopupId(null);
        return;
      }

      goToCheckoutUrl(data.url);
    } catch {
      setPackError("Could not start checkout. Please try again.");
      setCheckingOutTopupId(null);
    }
  }

  const savePercent = maxYearlyPercentOff(plans);

  // Portaled to <body> so the fixed overlay always covers the full viewport
  // (including the sidebar) -- some pages wrap their content in a
  // positioned, z-indexed container (e.g. AuroraBackground's `relative z-0`
  // root) that would otherwise create a stacking context and trap this
  // modal below sibling elements like the sidebar.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 sm:px-4 sm:py-8 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-full max-h-none w-full flex-col overflow-hidden rounded-none border-0 bg-surface sm:h-[94vh] sm:w-full sm:max-w-7xl sm:rounded-card-lg sm:border sm:border-primary/15 sm:shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-subtle shadow-sm backdrop-blur-sm transition-colors hover:bg-app hover:text-heading sm:right-5 sm:top-5"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex-1 overflow-y-auto px-6 py-6 sm:px-12 sm:py-10 lg:px-16">
          {/* Premium ambient surface -- two soft brand-blue glows anchored
              to the left and right edges (not a centered dome), drifting
              slowly for a living feel (animate-blob-a/b, shared with
              other hero surfaces -- paused under prefers-reduced-motion).
              Offset side light reads as designed ambience; one flat
              centered dome reads as a cheap spotlight. A faint dot grid
              and grain texture add depth on top. Lives inside the scroll
              container (not the outer modal box) and scrolls away with
              the content instead of staying pinned in view. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[640px] [mask-image:linear-gradient(to_bottom,black_0%,black_45%,transparent_85%)]">
              <div
                className="animate-blob-a absolute -left-48 top-[8%] h-[600px] w-[600px] rounded-full blur-[150px]"
                style={{ background: "radial-gradient(circle, rgba(51,92,255,0.55), transparent 70%)" }}
              />
              <div
                className="animate-blob-b absolute -right-48 top-[8%] h-[600px] w-[600px] rounded-full blur-[150px]"
                style={{ background: "radial-gradient(circle, rgba(77,114,255,0.55), transparent 70%)" }}
              />
            </div>
            <div
              className="absolute inset-x-0 top-0 h-[640px] opacity-[0.05] [mask-image:radial-gradient(65%_55%_at_50%_0%,black_0%,transparent_75%)] dark:opacity-[0.08]"
              style={{
                backgroundImage: "radial-gradient(circle, #335cff 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-[640px] opacity-[0.02] mix-blend-overlay dark:opacity-[0.04]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          </div>

          {/* min-h-full keeps this wrapper pinned to the scroll container's
              full height so the toggle/heading below stay put -- only the
              *tab body* (the nested flex-1 further down) recenters itself
              in the leftover space, so switching tabs never moves the
              toggle. The taller tab (plan) still just grows past min-h-full
              and scrolls normally. */}
          <div className="relative mx-auto flex min-h-full w-full flex-col">
            <PlanTopupToggle activeTab={tab} onChange={setTab} />

          <div className="mt-4 text-center sm:mt-6">
            <h2 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
              {tab === "plan" ? "Upgrade your plan" : "Top up your credits"}
            </h2>
            <p
              className={cn(
                "mx-auto mt-1 text-sm text-body sm:mt-2",
                tab === "plan" ? "max-w-md" : "max-w-md sm:max-w-none sm:whitespace-nowrap"
              )}
            >
              {tab === "plan"
                ? "Move to a higher plan for more monthly credits and features."
                : "Add extra credits any time. They never expire while your plan is active."}
            </p>
          </div>

          {/* Centers the shorter tab's body (topup) in the space left below
              the toggle/heading, without those two moving. */}
          <div className="flex flex-1 flex-col justify-start sm:justify-center">
          {tab === "plan" ? (
            <>
              <div className="mt-4 sm:mt-7">
                <PricingFrequencyToggle frequency={frequency} onChange={setFrequency} savePercent={savePercent || undefined} />
              </div>

              {planError && <p className="mt-4 text-center text-sm text-danger">{planError}</p>}

              <div className="mx-auto mt-5 grid w-full max-w-6xl grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-8">
                {plans.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={{ ...plan, cta: checkingOutPlanId === plan.id ? "Starting checkout…" : plan.cta }}
                    frequency={frequency}
                    onSelect={handleSelectPlan}
                    isCurrentPlan={plan.id === currentPlanId}
                    subscriptionStatus={subscriptionStatus}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {packError && <p className="mt-4 text-center text-sm text-danger">{packError}</p>}

              <CreditTopupPanel onCheckoutPack={handleCheckoutPack} checkingOutId={checkingOutTopupId} />
            </>
          )}
          </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
