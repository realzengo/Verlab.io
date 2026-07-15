import { PRICING_PLANS } from "@/lib/mock-data";
import { PlansEditor } from "@/components/admin/PlansEditor";

export default function AdminPlansPage() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-sm font-semibold text-heading">Pricing plans</h2>
        <p className="text-xs text-body">
          Edit plan pricing, copy, and feature bullets. Changes preview live against the actual pricing card.
        </p>
      </div>
      <PlansEditor initialPlans={PRICING_PLANS} />
    </div>
  );
}
