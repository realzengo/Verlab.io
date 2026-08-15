import NumberFlow from "@number-flow/react";
import Image from "next/image";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

// Splits "1,000 Credits (AI Tools)" into a bold lead ("1,000 Credits") and a
// plain trailing descriptor ("(AI Tools)").
function splitFeatureText(text: string): { bold: string; rest: string } {
  const parenIndex = text.indexOf(" (");
  if (parenIndex === -1) return { bold: text, rest: "" };
  return { bold: text.slice(0, parenIndex), rest: text.slice(parenIndex + 1) };
}

// The reference always shows a per-month figure -- in yearly mode that's the
// discounted monthly-equivalent (annual total / 12), with the real annual
// total moved into the subtext ("per month, billed at $X per year").
function yearlySavePercent(plan: PricingPlan): number {
  if (plan.monthlyOnly || plan.price.monthly === 0) return 0;
  return Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100);
}

export function PricingCard({
  plan,
  frequency,
  onSelect,
  ctaHref,
  compact = false,
}: {
  plan: PricingPlan;
  frequency: PricingFrequency;
  onSelect?: (plan: PricingPlan) => void;
  ctaHref?: string;
  /** Skips the recommended card's scale-up — for narrow containers (e.g. the admin preview) where the 8% scale would overflow and overlap neighboring content. */
  compact?: boolean;
}) {
  const yearlyUnavailable = plan.monthlyOnly && frequency === "yearly";
  const isYearly = frequency === "yearly";
  const price = isYearly ? Math.round(plan.price.yearly / 12) : plan.price.monthly;
  const savePercent = isYearly ? yearlySavePercent(plan) : 0;

  const ctaClassName = cn(
    "mb-5 w-full rounded-xl py-2.5 text-center text-[13px] font-semibold transition-all disabled:pointer-events-none disabled:opacity-50",
    plan.recommended
      ? "bg-primary text-white shadow-md hover:bg-primary-hover"
      : "border border-btn-secondary-border bg-btn-secondary text-heading hover:bg-btn-secondary-hover"
  );

  const priceBlock = (
    <>
      <h2 className="mb-1.5 text-lg font-semibold text-heading">{plan.name}</h2>
      <p className="mb-4 text-[13px] text-subtle">{plan.info}</p>

      {yearlyUnavailable ? (
        <p className="mt-2 mb-5 text-[11px] text-subtle">Not available on yearly billing</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold leading-none text-heading">
              $<NumberFlow value={price} className="text-3xl font-bold leading-none text-heading" />
            </span>
            {savePercent > 0 && (
              <span className="rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success">
                Save {savePercent}%
              </span>
            )}
          </div>
          <p className="mt-2 mb-5 text-[11px] text-subtle">
            {isYearly ? `per month, billed at $${plan.price.yearly} per year` : "billed monthly"}
          </p>
        </>
      )}

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

      <div className="mt-1 flex w-full flex-col">
        <p className="mb-2.5 text-[11px] font-bold text-heading">Whats inside:</p>

        <ul className="flex w-full flex-col">
          {plan.features.map((feature) => {
            const { bold, rest } = splitFeatureText(feature.text);
            return (
              <li key={feature.text} className="flex w-full flex-col">
                <div className="flex w-full items-start gap-2">
                  <svg
                    className={cn("mt-0.5 h-3 w-3 shrink-0", plan.recommended ? "text-primary" : "text-heading")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>

                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="font-semibold text-heading">{bold}</span>
                    {rest && <span className="text-subtle">{rest}</span>}
                  </div>
                </div>

                <div className="my-2.5 h-px w-full bg-hairline" />
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );

  if (plan.recommended) {
    return (
      <div
        className={cn(
          "relative z-10 flex flex-col rounded-[2rem] bg-gradient-to-b from-primary to-primary/60 p-[6px] pt-0",
          !compact && "lg:scale-[1.08]"
        )}
      >
        <div className="flex h-9 items-center justify-center gap-1.5 text-sm font-bold text-white">
          <Image src="/icons/fire.svg" alt="" width={20} height={20} className="h-5 w-5" />
          Most Popular
        </div>
        <div className="flex w-full h-full flex-grow flex-col items-stretch rounded-[1.625rem] bg-surface px-6 py-8 text-left">
          {priceBlock}
        </div>
      </div>
    );
  }

  return <div className="flex h-full flex-col rounded-3xl border border-hairline bg-surface p-6 shadow-card">{priceBlock}</div>;
}
