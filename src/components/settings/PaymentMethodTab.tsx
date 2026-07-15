import { Crown, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MOCK_USER, PRICING_PLANS } from "@/lib/mock-data";

export function PaymentMethodTab() {
  const currentPlan = PRICING_PLANS.find((plan) => plan.id === MOCK_USER.plan) ?? PRICING_PLANS[0];

  return (
    <Card className="max-w-xl">
      <h2 className="text-lg font-semibold text-heading">Payment methods</h2>
      <div className="mt-4 border-b border-hairline" />

      <div className="mt-6 flex items-center justify-between">
        <h3 className="font-medium text-heading">Current Plan</h3>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Zap className="h-4 w-4" />
          View other plans
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-hairline bg-app p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-body">Subscription end date</span>
          <span className="rounded-full bg-accent px-2 py-1 text-xs text-primary">
            07/27/26
          </span>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary p-2 text-white">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-heading">{currentPlan.name}</p>
              <p className="text-sm text-body">{currentPlan.info}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-heading">
              ${currentPlan.price.monthly} <span className="text-sm font-normal text-body">/month</span>
            </p>
            <p className="text-sm text-body">Renews on 7/27/2026</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-body">Subscription Status</span>
            <span className="text-body">12 days remaining</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-hairline">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: "60%" }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-body">
            <span>Start Date: 06/27/26</span>
            <span>End Date: 07/27/26</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-hairline bg-surface p-4">
          <p className="text-sm font-medium text-heading">Daily Transcripts</p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-hairline">
            <div className="h-1.5 w-full rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-sm text-body">Unlimited</p>
        </div>
        <div className="rounded-lg border border-hairline bg-surface p-4">
          <p className="text-sm font-medium text-heading">Transcripts Count</p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-hairline">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: "57%" }} />
          </div>
          <p className="mt-2 text-sm text-body">57</p>
        </div>
      </div>
    </Card>
  );
}
