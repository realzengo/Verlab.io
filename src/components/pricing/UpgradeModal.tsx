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
      const { data } = await supabase.from("plan_definitions").select(PLAN_DEFINITION_SELECT).order("sort_order");
      if (!cancelled && data && data.length > 0) {
        setPlans((data as PlanDefinitionRow[]).map(planRowToPricingPlan));
      }
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
        setPackError(data.error ?? "Could not start checkout");
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
        {/* Verlab-blue ambient background -- top key-light glow, a faint dot
            grid fading toward the center, and a hairline of brand color
            tracing the top edge. Placed first with no z-index so DOM order
            (not stacking-context tricks) keeps it beneath the close button
            and content -- a negative z-index here would escape this box's
            own background, since a plain `relative` div doesn't form a
            stacking context on its own. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 h-[420px] [mask-image:linear-gradient(to_bottom,black_0%,black_15%,transparent_75%)]"
            style={{
              backgroundImage:
                "radial-gradient(60% 70% at 50% -10%, rgba(51,92,255,0.24) 0%, rgba(51,92,255,0.08) 45%, transparent 75%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(60%_55%_at_50%_0%,black_0%,transparent_75%)]"
            style={{
              backgroundImage: "radial-gradient(circle, #335cff 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-app hover:text-heading"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-12 sm:py-10 lg:px-16">
          {/* min-h-full keeps this wrapper pinned to the scroll container's
              full height so the toggle/heading below stay put -- only the
              *tab body* (the nested flex-1 further down) recenters itself
              in the leftover space, so switching tabs never moves the
              toggle. The taller tab (plan) still just grows past min-h-full
              and scrolls normally. */}
          <div className="mx-auto flex min-h-full w-full flex-col">
            <PlanTopupToggle activeTab={tab} onChange={setTab} />

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

          {/* Centers the shorter tab's body (topup) in the space left below
              the toggle/heading, without those two moving. */}
          <div className="flex flex-1 flex-col justify-center">
          {tab === "plan" ? (
            <>
              <div className="mt-7">
                <PricingFrequencyToggle frequency={frequency} onChange={setFrequency} savePercent={savePercent || undefined} />
              </div>

              {planError && <p className="mt-4 text-center text-sm text-danger">{planError}</p>}

              <div className="mx-auto mt-10 grid w-full max-w-6xl grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
                {plans.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={{ ...plan, cta: checkingOutPlanId === plan.id ? "Starting checkout…" : plan.cta }}
                    frequency={frequency}
                    onSelect={handleSelectPlan}
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
