import NumberFlow from "@number-flow/react";
import { CheckCheck, Database, Search, Sparkles } from "lucide-react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

// Splits "1,000 Credits (AI Tools)" into a bold lead ("1,000 Credits") and a
// plain trailing descriptor ("(AI Tools)").
function splitFeatureText(text: string): { bold: string; rest: string } {
  const parenIndex = text.indexOf(" (");
  if (parenIndex === -1) return { bold: text, rest: "" };
  return { bold: text.slice(0, parenIndex), rest: text.slice(parenIndex + 1) };
}

// First 3 features are always credits / niche-bends / transcripts across all
// three tiers (see lib/mock/pricing.ts) -- a fixed icon per position instead
// of keyword-matching free text.
const FEATURE_ICONS = [Sparkles, Search, Database];

const INCLUDES_HEADING: Record<PricingPlan["id"], string> = {
  core: "Core includes:",
  pro: "Everything in Core, plus:",
  scale: "Everything in Pro, plus:",
};

export function PricingCard({
  plan,
  frequency,
  onSelect,
  ctaHref,
}: {
  plan: PricingPlan;
  frequency: PricingFrequency;
  onSelect?: (plan: PricingPlan) => void;
  ctaHref?: string;
}) {
  const yearlyUnavailable = plan.monthlyOnly && frequency === "yearly";
  const price = frequency === "yearly" ? plan.price.yearly : plan.price.monthly;

  const topFeatures = plan.features.slice(0, 3);
  const includes = plan.features.slice(3);

  const ctaClassName = cn(
    "mb-6 w-full rounded-xl p-4 text-center text-xl font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50",
    plan.recommended
      ? "border border-blue-400/60 bg-gradient-to-t from-blue-500 to-blue-600 text-white shadow-blue"
      : "border border-white/10 bg-gradient-to-t from-neutral-900 to-neutral-700 text-white shadow-card"
  );

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-card-lg border transition-shadow",
        plan.recommended ? "border-primary/40 bg-accent shadow-blue" : "border-hairline bg-surface shadow-card hover:shadow-card-hover"
      )}
    >
      <div className="p-6 text-left">
        <div className="flex justify-between">
          <h3 className="mb-2 text-3xl font-semibold text-heading">{plan.name}</h3>
          {plan.recommended && (
            <span className="flex h-fit items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-medium text-white shadow-[0_4px_14px_-2px_rgba(51,92,255,0.55)]">
              <img src="/icons/fire.svg" alt="" className="h-4 w-4" />
              Popular
            </span>
          )}
        </div>
        <p className="mb-4 text-sm text-body">{plan.info}</p>
        {yearlyUnavailable ? (
          <p className="text-sm text-body">Not available on yearly billing</p>
        ) : (
          <div className="flex items-baseline">
            <span className="text-4xl font-semibold text-heading">
              $<NumberFlow value={price} className="text-4xl font-semibold" />
            </span>
            <span className="ml-1 text-body">/{frequency === "yearly" ? "year" : "month"}</span>
          </div>
        )}
      </div>

      <div className="px-6 pb-6 pt-0">
        {yearlyUnavailable ? (
          <button type="button" disabled className={ctaClassName}>
            {plan.cta}
          </button>
        ) : ctaHref ? (
          <a href={ctaHref} className={ctaClassName}>
            {plan.cta}
          </a>
        ) : (
          <button type="button" onClick={() => onSelect?.(plan)} className={ctaClassName}>
            {plan.cta}
          </button>
        )}

        <ul className="space-y-2 py-5 font-semibold">
          {topFeatures.map((feature, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <li key={feature.text} className="flex items-center">
                <span className="mr-3 mt-0.5 grid place-content-center text-subtle">
                  <Icon size={20} />
                </span>
                <span className="text-sm text-body">{feature.text}</span>
              </li>
            );
          })}
        </ul>

        {includes.length > 0 && (
          <div className="space-y-3 border-t border-hairline pt-4">
            <h4 className="mb-3 text-base font-medium text-heading">{INCLUDES_HEADING[plan.id]}</h4>
            <ul className="space-y-2 font-semibold">
              {includes.map((feature) => {
                const { bold, rest } = splitFeatureText(feature.text);
                return (
                  <li key={feature.text} className="flex items-center">
                    <span className="mr-3 mt-0.5 grid h-6 w-6 place-content-center rounded-full border border-primary/40 bg-accent">
                      <CheckCheck className="h-4 w-4 text-primary" />
                    </span>
                    <span className="text-sm text-body">
                      <span className="font-semibold text-heading">{bold}</span>
                      {rest && <span className="ml-1">{rest}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
