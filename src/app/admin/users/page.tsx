import { ShieldAlert, UserCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import { getAdminUsers } from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { UsersTable } from "@/components/admin/UsersTable";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { users: ADMIN_USERS, nowIso: NOW_ISO } = await getAdminUsers();
  const TOTAL_USERS_COUNT = ADMIN_USERS.length;
  const PAYING_USERS_COUNT = ADMIN_USERS.filter((u) => u.status === "active" || u.status === "past_due").length;
  const ACTIVE_TRIALS_COUNT = ADMIN_USERS.filter((u) => u.status === "trialing").length;
  const suspended = ADMIN_USERS.filter((u) => u.status === "suspended").length;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <UsersIcon className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-xs text-body">Total users</p>
            <p className="text-lg font-semibold text-heading">{formatNumber(TOTAL_USERS_COUNT)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-tint text-success">
            <UserCheck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-xs text-body">Paying accounts</p>
            <p className="text-lg font-semibold text-heading">{formatNumber(PAYING_USERS_COUNT)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-tint text-warning">
            <UserPlus className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-xs text-body">Active trials</p>
            <p className="text-lg font-semibold text-heading">{formatNumber(ACTIVE_TRIALS_COUNT)}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-heading">All users</h3>
            <p className="text-xs text-body">Search, filter, and manage individual accounts</p>
          </div>
          {suspended > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-danger-tint px-3 py-1 text-xs font-medium text-danger">
              <ShieldAlert className="h-3.5 w-3.5" />
              {suspended} suspended
            </span>
          )}
        </div>
        <UsersTable users={ADMIN_USERS} nowIso={NOW_ISO} />
      </Card>
    </div>
  );
}
