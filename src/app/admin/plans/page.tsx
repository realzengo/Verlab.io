import { getPlanDefinitions } from "@/lib/server/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { PlansEditor } from "@/components/admin/PlansEditor";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const supabase = await createClient();
  const plans = await getPlanDefinitions(supabase);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-sm font-semibold text-heading">Pricing plans</h2>
        <p className="text-xs text-body">
          Edit plan pricing, copy, and feature bullets. Changes preview live against the actual pricing card.
        </p>
      </div>
      <PlansEditor initialPlans={plans} />
    </div>
  );
}
