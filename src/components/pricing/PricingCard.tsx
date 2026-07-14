import { Check } from "lucide-react";
import type { PricingPlan } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function PricingCard({
  plan,
  onSelect,
  ctaHref,
}: {
  plan: PricingPlan;
  onSelect?: (plan: PricingPlan) => void;
  ctaHref?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-6",
        plan.recommended && "border-primary ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-heading">{plan.name}</h3>
        {plan.recommended && <Badge>Recommended</Badge>}
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold text-heading">${plan.price}</span>
          <span className="text-sm text-body">
            /{plan.billingPeriod === "forever" ? "forever" : plan.billingPeriod}
          </span>
        </div>
        {plan.priceNote && <p className="mt-1 text-xs font-medium text-primary">{plan.priceNote}</p>}
        {plan.limits && <p className="mt-1 text-xs text-body">{plan.limits}</p>}
      </div>

      <ul className="flex flex-1 flex-col gap-2.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-heading">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {feature}
          </li>
        ))}
      </ul>

      {ctaHref ? (
        <Button href={ctaHref} variant={plan.recommended ? "primary" : "secondary"}>
          {plan.cta}
        </Button>
      ) : (
        <Button variant={plan.recommended ? "primary" : "secondary"} onClick={() => onSelect?.(plan)}>
          {plan.cta}
        </Button>
      )}
    </Card>
  );
}
