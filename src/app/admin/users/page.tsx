import { getAdminUsers } from "@/lib/server/admin-queries";
import type { AdminUser, AdminUserStatus } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip, signed } from "@/components/admin/KpiStrip";
import { UsersTable } from "@/components/admin/UsersTable";
import { ColumnChart } from "@/components/admin/charts/ColumnChart";
import { ShareBar } from "@/components/admin/charts/ShareBar";
import { formatStat, sumOf } from "@/components/admin/charts/format";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Free sits below the paid tiers on the same ordinal ramp, as its quietest step.
const PLAN_SEGMENTS: { plan: AdminUser["plan"]; label: string; color: string }[] = [
  { plan: "free", label: "Free", color: "var(--viz-neutral)" },
  { plan: "core", label: "Core", color: "var(--viz-tier-1)" },
  { plan: "pro", label: "Pro", color: "var(--viz-tier-2)" },
  { plan: "scale", label: "Scale", color: "var(--viz-tier-3)" },
];

// Status color only where the state is good or bad; neutral states stay gray.
const STATUS_SEGMENTS: { status: AdminUserStatus; label: string; color: string }[] = [
  { status: "active", label: "Active", color: "var(--viz-good)" },
  { status: "trialing", label: "Trialing", color: "var(--viz-1)" },
  { status: "free", label: "Free", color: "var(--viz-neutral)" },
  { status: "past_due", label: "Past due", color: "var(--viz-warning)" },
  { status: "canceled", label: "Canceled", color: "var(--viz-serious)" },
  { status: "suspended", label: "Suspended", color: "var(--viz-critical)" },
];

function last30Days(nowIso: string): string[] {
  const today = new Date(nowIso);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default async function AdminUsersPage() {
  const { users, nowIso, activeNowCount } = await getAdminUsers();
  const total = users.length;
  // mrr > 0, not status === "active" -- "active" also covers free accounts
  // with no subscription at all, which aren't paying anything.
  const paying = users.filter((u) => u.mrr > 0).length;
  const trialing = users.filter((u) => u.status === "trialing").length;

  const days = last30Days(nowIso);
  const signupsByDay = new Map(days.map((d) => [d, 0]));
  for (const u of users) if (signupsByDay.has(u.signupDate)) signupsByDay.set(u.signupDate, signupsByDay.get(u.signupDate)! + 1);
  const signups = days.map((d) => signupsByDay.get(d) ?? 0);
  const signups30d = sumOf(signups);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" description="Every account, its plan and how much it uses the product." />

      <KpiStrip>
        <Kpi
          label="Total accounts"
          value={formatStat(total)}
          delta={{ value: signed(signups30d), direction: signups30d > 0 ? "up" : "flat", sentiment: signups30d > 0 ? "positive" : "neutral", label: "last 30 days" }}
        />
        <Kpi
          label="Active now"
          value={formatStat(activeNowCount)}
          footnote="in the last 5 minutes"
          indicator={
            <span className="relative flex h-1.5 w-1.5" title="Signed in or ran a tool in the last 5 minutes">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--viz-good) opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-(--viz-good)" />
            </span>
          }
        />
        <Kpi
          label="Paying accounts"
          value={formatStat(paying)}
          footnote={total > 0 ? `${Math.round((paying / total) * 100)}% of all accounts` : undefined}
        />
        <Kpi label="Active trials" value={formatStat(trialing)} />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Signups" description={`${formatNumber(signups30d)} new accounts, last 30 days`}>
          <ColumnChart dates={days} values={signups} label="Signups" ariaLabel="New accounts per day, last 30 days" />
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="By plan">
            <ShareBar
              segments={PLAN_SEGMENTS.map((s) => ({ label: s.label, value: users.filter((u) => u.plan === s.plan).length, color: s.color }))}
            />
          </Panel>
          <Panel title="By status">
            <ShareBar
              segments={STATUS_SEGMENTS.map((s) => ({
                label: s.label,
                value: users.filter((u) => u.status === s.status).length,
                color: s.color,
              })).filter((s) => s.value > 0)}
            />
          </Panel>
        </div>
      </div>

      <UsersTable users={users} nowIso={nowIso} />
    </div>
  );
}
