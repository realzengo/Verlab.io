import { getAdminTeam, getFeatureFlags } from "@/lib/server/admin-queries";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { FeatureFlagsList } from "@/components/admin/FeatureFlagsList";
import { AdminTeamCard } from "@/components/admin/AdminTeamCard";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [featureFlags, adminTeam] = await Promise.all([getFeatureFlags(), getAdminTeam()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Feature rollouts and who can reach this dashboard." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Feature flags"
          description="Roll new tools and pipelines out across the user base"
        >
          <FeatureFlagsList flags={featureFlags} />
        </Panel>

        <div className="xl:col-span-2">
          <AdminTeamCard initialTeam={adminTeam} />
        </div>
      </div>
    </div>
  );
}
