import { getPlanDefinitions } from "@/lib/server/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { PlansEditor } from "@/components/admin/PlansEditor";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const supabase = await createClient();
  const plans = await getPlanDefinitions(supabase);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-heading">Pricing & plans</h2>
        <Badge variant="success">Live</Badge>
      </div>
      <p className="-mt-4 max-w-xl text-sm text-body">
        Edit plan pricing, copy, and feature bullets. Changes save straight to the database and go live on the public
        pricing page and every in-app upgrade prompt immediately.
      </p>
      <PlansEditor initialPlans={plans} />
    </div>
  );
}
