import { getAdminTeam, getFeatureFlags } from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { FeatureFlagsList } from "@/components/admin/FeatureFlagsList";
import { AdminTeamCard } from "@/components/admin/AdminTeamCard";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [FEATURE_FLAGS, ADMIN_TEAM] = await Promise.all([getFeatureFlags(), getAdminTeam()]);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Card>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-heading">Feature flags</h3>
          <p className="text-xs text-body">Roll out new tools and pipelines gradually across the user base</p>
        </div>
        <FeatureFlagsList flags={FEATURE_FLAGS} />
      </Card>

      <AdminTeamCard initialTeam={ADMIN_TEAM} />
    </div>
  );
}
