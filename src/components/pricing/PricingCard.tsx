import { Check, Star } from "lucide-react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

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
  const monthlyEquivalent = Math.round(plan.price.yearly / 12);
  const price = frequency === "yearly" ? monthlyEquivalent : plan.price.monthly;
  const percentOff =
    plan.price.monthly > 0 && !plan.monthlyOnly
      ? Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100)
      : 0;

  return (
    <Card
      className={cn(
        "relative flex flex-col gap-6",
        plan.recommended && "border-primary shadow-blue ring-2 ring-primary/20",
        yearlyUnavailable && "opacity-50"
      )}
    >
      <div className="absolute right-6 top-6 flex items-center gap-2">
        {plan.recommended && (
          <Badge>
            <Star className="h-3 w-3 fill-current" />
            Popular
          </Badge>
        )}
        {frequency === "yearly" && percentOff > 0 && <Badge variant="success">{percentOff}% off</Badge>}
      </div>

      <div>
        <h3 className="text-base font-semibold text-heading">{plan.name}</h3>
        <p className="mt-1 text-sm text-body">{plan.info}</p>
      </div>

      <div>
        {yearlyUnavailable ? (
          <p className="text-sm text-body">Not available on yearly billing</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold text-heading">${price}</span>
              {price > 0 && <span className="text-sm text-body">/month</span>}
            </div>
            {frequency === "yearly" && (
              <p className="mt-1 text-xs text-body">Billed annually at ${plan.price.yearly}/year</p>
            )}
          </>
        )}
        {plan.limits && <p className="mt-1 text-xs text-body">{plan.limits}</p>}
      </div>

      <ul className="flex flex-1 flex-col gap-2.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-heading">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {feature.tooltip ? (
              <Tooltip content={feature.tooltip}>
                <span className="cursor-default border-b border-dashed border-hairline">{feature.text}</span>
              </Tooltip>
            ) : (
              feature.text
            )}
          </li>
        ))}
      </ul>

      {yearlyUnavailable ? (
        <Button variant="secondary" bevel={false} disabled>
          {plan.cta}
        </Button>
      ) : ctaHref ? (
        <Button href={ctaHref} variant={plan.recommended ? "primary" : "secondary"} bevel={false}>
          {plan.cta}
        </Button>
      ) : (
        <Button variant={plan.recommended ? "primary" : "secondary"} bevel={false} onClick={() => onSelect?.(plan)}>
          {plan.cta}
        </Button>
      )}
    </Card>
  );
}
