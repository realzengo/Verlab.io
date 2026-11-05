import { getPlanDefinitions } from "@/lib/server/admin-queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlansEditor } from "@/components/admin/PlansEditor";
import { LiveIndicator, PageHeader } from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const plans = await getPlanDefinitions(createAdminClient());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plans"
        description="Pricing, copy and feature bullets. Saving publishes straight to the pricing page and every in-app upgrade prompt."
      >
        <LiveIndicator label="Published" />
      </PageHeader>
      <PlansEditor initialPlans={plans} />
    </div>
  );
}
