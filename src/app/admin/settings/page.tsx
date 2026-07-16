import { ShieldCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import { getAdminTeam, getFeatureFlags } from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeatureFlagsList } from "@/components/admin/FeatureFlagsList";
import { formatDate } from "@/lib/utils";
import type { AdminRole } from "@/lib/types";

const ROLE_VARIANT: Record<AdminRole, "success" | "default" | "warning"> = {
  owner: "success",
  admin: "default",
  support: "warning",
};

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

      <Card>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-heading">Admin team</h3>
            <p className="text-xs text-body">People with access to this dashboard</p>
          </div>
          <Button variant="secondary" size="sm" icon={UserPlus}>
            Invite admin
          </Button>
        </div>
        {ADMIN_TEAM.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No admin team members yet"
            description="Access is controlled by the ADMIN_EMAILS environment variable. Add a row here for each admin to show their name, role, and last login."
          />
        ) : (
        <div className="flex flex-col divide-y divide-hairline">
          {ADMIN_TEAM.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
              <Avatar name={member.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-heading">{member.name}</p>
                <p className="truncate text-xs text-body">{member.email}</p>
              </div>
              <span className="hidden text-xs text-subtle sm:block">Last login {formatDate(member.lastLogin)}</span>
              <Badge variant={ROLE_VARIANT[member.role]}>
                <ShieldCheck className="h-3 w-3" />
                {member.role}
              </Badge>
            </div>
          ))}
        </div>
        )}
      </Card>
    </div>
  );
}
