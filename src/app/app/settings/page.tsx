import { CreditCard } from "lucide-react";
import { MOCK_USER, PRICING_PLANS } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PricingTable } from "@/components/pricing/PricingTable";

const PLAN_LABEL: Record<typeof MOCK_USER.plan, string> = {
  free: "Free",
  monthly: "Monthly",
  annual: "Annual",
};

export default function SettingsPage() {
  const currentPlan = PRICING_PLANS.find((plan) => plan.id === MOCK_USER.plan);

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-chip bg-accent">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-heading">
              {PLAN_LABEL[MOCK_USER.plan]} plan
              {currentPlan && <span className="ml-2 text-body">${currentPlan.price}/{currentPlan.billingPeriod}</span>}
            </p>
            <p className="text-xs text-body">Billed via Whop · renews Aug 14, 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">Active</Badge>
          <Button variant="secondary" size="sm">
            Manage billing
          </Button>
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-body">Change plan</h3>
        <div className="mt-4">
          <PricingTable plans={PRICING_PLANS} ctaHrefFor={() => "/app/settings"} />
        </div>
      </div>
    </div>
  );
}
