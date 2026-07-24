import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICING_PLANS } from "@/lib/mock/pricing";
import type {
  ActivityLogEntry,
  AdminTeamMember,
  AdminToolKey,
  AdminUser,
  CreditsAdminUser,
  CreditsOverview,
  FeatureFlag,
  PlanDistribution,
  PricingPlan,
  SignupPoint,
  SystemJob,
  SystemJobStatus,
  SystemJobType,
  ToolTone,
  ToolUsageShare,
  UsagePoint,
} from "@/lib/types";

// Real, DB-backed replacements for src/lib/mock/admin.ts. No revenue/MRR/
// churn/transactions here on purpose — those need real Stripe events, which
// this pass doesn't build. Callers should render an honest zero/empty state
// for anything billing-shaped rather than fabricating numbers.

const TOOL_LABELS: Record<AdminToolKey, string> = {
  bend: "Niche Bending",
  niches: "Niche Finder",
  transcripts: "Transcripts",
  downloader: "Downloader",
  mcp: "MCP",
  image: "Image Generator",
};

const TOOL_TONES: Record<AdminToolKey, ToolTone> = {
  bend: "violet",
  niches: "blue",
  transcripts: "amber",
  downloader: "green",
  mcp: "rose",
  image: "sky",
};

function last30Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function listAllUsers() {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data?.users ?? [];
}

export async function getSignupSeries(): Promise<SignupPoint[]> {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);

  const { data } = await admin.from("profiles").select("created_at").gte("created_at", since.toISOString());

  const days = last30Days();
  const counts = new Map(days.map((d) => [d, 0]));
  for (const row of data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  // "trials" has no meaning without billing — always 0.
  return days.map((date) => ({ date, signups: counts.get(date) ?? 0, trials: 0 }));
}

export async function getUsageData(): Promise<{ series: UsagePoint[]; share: ToolUsageShare[] }> {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);

  const { data } = await admin.from("usage_events").select("tool, created_at").gte("created_at", since.toISOString());

  const days = last30Days();
  const byDay = new Map(days.map((d) => [d, { bend: 0, niches: 0, transcripts: 0, downloader: 0, mcp: 0, image: 0 }]));
  const totals: Record<AdminToolKey, number> = { bend: 0, niches: 0, transcripts: 0, downloader: 0, mcp: 0, image: 0 };

  for (const row of data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    const tool = row.tool as AdminToolKey;
    const bucket = byDay.get(day);
    if (bucket) bucket[tool] += 1;
    totals[tool] += 1;
  }

  const series = days.map((date) => ({ date, ...byDay.get(date)! }));
  const share: ToolUsageShare[] = (Object.keys(totals) as AdminToolKey[]).map((tool) => ({
    tool,
    label: TOOL_LABELS[tool],
    count: totals[tool],
    tone: TOOL_TONES[tool],
  }));

  return { series, share };
}

export async function getPlanDistribution(): Promise<PlanDistribution[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("plan");

  const counts: Record<string, number> = { core: 0, pro: 0, scale: 0 };
  for (const row of data ?? []) counts[row.plan] = (counts[row.plan] ?? 0) + 1;

  const LABEL: Record<string, string> = { core: "Core", pro: "Pro", scale: "Scale" };
  const TONE: Record<string, ToolTone> = { core: "sky", pro: "blue", scale: "violet" };

  return (["core", "pro", "scale"] as const).map((plan) => ({
    plan,
    label: LABEL[plan],
    count: counts[plan] ?? 0,
    tone: TONE[plan],
  }));
}

export async function getActivityLog(limit = 10): Promise<ActivityLogEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("activity_log")
    .select("id, type, message, actor, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    actor: row.actor,
    timestamp: row.created_at,
  }));
}

export async function getAdminUsers(): Promise<{ users: AdminUser[]; nowIso: string }> {
  const admin = createAdminClient();
  const [authUsers, { data: profiles }, { data: usageRows }] = await Promise.all([
    listAllUsers(),
    admin.from("profiles").select("id, full_name, plan"),
    admin.from("usage_events").select("user_id, tool"),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const usageByUser = new Map<string, { bends: number; transcripts: number; downloads: number; apiCalls: number }>();

  for (const row of usageRows ?? []) {
    const bucket = usageByUser.get(row.user_id) ?? { bends: 0, transcripts: 0, downloads: 0, apiCalls: 0 };
    if (row.tool === "bend") bucket.bends += 1;
    else if (row.tool === "transcripts") bucket.transcripts += 1;
    else if (row.tool === "downloader") bucket.downloads += 1;
    else if (row.tool === "mcp") bucket.apiCalls += 1;
    usageByUser.set(row.user_id, bucket);
  }

  const users: AdminUser[] = authUsers.map((u) => {
    const profile = profileById.get(u.id) as { full_name: string | null; plan: AdminUser["plan"] } | undefined;
    const usage = usageByUser.get(u.id) ?? { bends: 0, transcripts: 0, downloads: 0, apiCalls: 0 };
    return {
      id: u.id,
      name: profile?.full_name || u.email?.split("@")[0] || "Unnamed",
      email: u.email ?? "",
      plan: profile?.plan ?? "core",
      // No billing yet, so there's no real trial/past_due/canceled signal —
      // every account with a session is just "active".
      status: "active",
      mrr: 0,
      signupDate: (u.created_at ?? new Date().toISOString()).slice(0, 10),
      lastActiveAt: u.last_sign_in_at ?? u.created_at ?? new Date().toISOString(),
      country: "—",
      usage,
    };
  });

  return { users, nowIso: new Date().toISOString() };
}

function mapJobStatus(status: string): SystemJobStatus {
  if (status === "failed") return "failed";
  if (status === "ready" || status === "sop_ready" || status === "complete") return "success";
  if (status === "queued" || status === "opening_channel") return "queued";
  return "running";
}

export async function getSystemJobs(limit = 20): Promise<SystemJob[]> {
  const admin = createAdminClient();
  const [{ data: bendJobs }, { data: transcriptJobs }, { data: downloadJobs }, authUsers] = await Promise.all([
    admin
      .from("niche_bend_jobs")
      .select("id, status, user_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("transcripts")
      .select("id, status, user_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("downloads")
      .select("id, status, user_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    listAllUsers(),
  ]);

  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? "—"]));

  function toDuration(status: string, createdAt: string, updatedAt: string): number | undefined {
    const settled = status === "failed" || status === "success" || status === "ready" || status === "sop_ready" || status === "complete";
    return settled ? new Date(updatedAt).getTime() - new Date(createdAt).getTime() : undefined;
  }

  const jobs: SystemJob[] = [
    ...(bendJobs ?? []).map((j) => ({
      id: j.id,
      type: "niche-bend" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "—",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
    })),
    ...(transcriptJobs ?? []).map((j) => ({
      id: j.id,
      type: "transcript" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "—",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
    })),
    ...(downloadJobs ?? []).map((j) => ({
      id: j.id,
      type: "download" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "—",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
    })),
  ];

  return jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, limit);
}

export function computeJobSuccessRate(jobs: SystemJob[]): number {
  const settled = jobs.filter((j) => j.status === "success" || j.status === "failed");
  if (settled.length === 0) return 100;
  return Number(((settled.filter((j) => j.status === "success").length / settled.length) * 100).toFixed(1));
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("feature_flags")
    .select("id, label, description, enabled, rollout_pct")
    .order("id");

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    enabled: row.enabled,
    rolloutPct: row.rollout_pct,
  }));
}

export async function getAdminTeam(): Promise<AdminTeamMember[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_team")
    .select("id, name, email, role, last_login_at")
    .order("created_at");

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    lastLogin: row.last_login_at ?? new Date(0).toISOString(),
  }));
}

interface PlanDefinitionRow {
  id: string;
  name: string;
  info: string;
  price_monthly: number;
  price_yearly: number;
  recommended: boolean;
  monthly_only: boolean;
  cta: string;
  features: { text: string; tooltip?: string }[];
  limits: string | null;
  sort_order: number;
}

function planRowToPricingPlan(row: PlanDefinitionRow): PricingPlan {
  return {
    id: row.id as PricingPlan["id"],
    name: row.name,
    info: row.info,
    price: { monthly: row.price_monthly, yearly: row.price_yearly },
    recommended: row.recommended || undefined,
    monthlyOnly: row.monthly_only || undefined,
    cta: row.cta,
    features: row.features,
    limits: row.limits ?? undefined,
  };
}

/**
 * plan_definitions has a public read RLS policy, so this works with either
 * the caller's regular (cookie-scoped) client or the service-role client —
 * pass whichever the caller already has on hand.
 *
 * Falls back to the static PRICING_PLANS until the plan_definitions
 * migration is applied and payment (Polar) is wired up.
 */
export async function getPlanDefinitions(supabase: SupabaseClient): Promise<PricingPlan[]> {
  const { data } = await supabase.from("plan_definitions").select("*").order("sort_order");
  const rows = (data as PlanDefinitionRow[]) ?? [];
  if (rows.length === 0) return PRICING_PLANS;
  return rows.map(planRowToPricingPlan);
}

const ACTION_TONES: ToolTone[] = ["blue", "violet", "amber", "green", "rose", "sky"];

// action_key values are dotted/underscored pricing.ts config keys (e.g.
// "niche_bend.analyze_scrape", "image.nano_banana_pro") -- humanized
// generically rather than via a hand-maintained label map, so this never
// drifts out of sync with new keys added to pricing.ts.
function humanizeActionKey(key: string | null): string {
  if (!key) return "Other";
  return key
    .replace(/[._]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export async function getCreditsOverview(): Promise<CreditsOverview> {
  const admin = createAdminClient();
  const since30 = new Date();
  since30.setUTCDate(since30.getUTCDate() - 29);

  const [authUsers, { data: profiles }, { data: recentTxRows }, { data: ledger30Rows }] = await Promise.all([
    listAllUsers(),
    admin.from("profiles").select("id, full_name, plan, credits"),
    admin
      .from("credit_transactions")
      .select("id, user_id, amount, feature, action_key, granted_by, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("credit_transactions")
      .select("user_id, amount, action_key, created_at")
      .gte("created_at", since30.toISOString()),
  ]);

  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? "—"]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p as { full_name: string | null; plan: AdminUser["plan"]; credits: number }])
  );
  const nameFor = (userId: string) =>
    profileById.get(userId)?.full_name || emailById.get(userId)?.split("@")[0] || "Unknown";

  const totalOutstanding = (profiles ?? []).reduce((sum, p) => sum + (p.credits ?? 0), 0);

  const days = last30Days();
  const byDay = new Map(days.map((d) => [d, { spent: 0, granted: 0 }]));
  const spendByActionMap = new Map<string, number>();
  const spendByUserMap = new Map<string, number>();

  const todayStr = days[days.length - 1];
  const since7Str = days[days.length - 7];

  let spentToday = 0;
  let spentLast7Days = 0;
  let spentLast30Days = 0;

  for (const row of ledger30Rows ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    const amount = row.amount as number;
    const bucket = byDay.get(day);

    if (amount < 0) {
      const spent = -amount;
      if (bucket) bucket.spent += spent;
      spentLast30Days += spent;
      if (day === todayStr) spentToday += spent;
      if (day >= since7Str) spentLast7Days += spent;
      const key = (row.action_key as string | null) ?? "other";
      spendByActionMap.set(key, (spendByActionMap.get(key) ?? 0) + spent);
      spendByUserMap.set(row.user_id, (spendByUserMap.get(row.user_id) ?? 0) + spent);
    } else if (bucket) {
      bucket.granted += amount;
    }
  }

  const dailySeries = days.map((date) => ({ date, ...byDay.get(date)! }));

  const spendByAction = [...spendByActionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([actionKey, amount], i) => ({
      actionKey,
      label: humanizeActionKey(actionKey === "other" ? null : actionKey),
      amount,
      tone: ACTION_TONES[i % ACTION_TONES.length],
    }));

  const topSpenders = [...spendByUserMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, spent30d]) => {
      const profile = profileById.get(userId);
      return {
        id: userId,
        name: nameFor(userId),
        email: emailById.get(userId) ?? "—",
        plan: profile?.plan ?? "core",
        spent30d,
        balance: profile?.credits ?? 0,
      };
    });

  const recentTransactions = (recentTxRows ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: nameFor(row.user_id),
    userEmail: emailById.get(row.user_id) ?? "—",
    amount: row.amount,
    feature: row.feature,
    actionKey: row.action_key,
    grantedBy: row.granted_by,
    createdAt: row.created_at,
  }));

  return {
    totalOutstanding,
    spentToday,
    spentLast7Days,
    spentLast30Days,
    dailySeries,
    spendByAction,
    topSpenders,
    recentTransactions,
  };
}

export async function getUsersForCreditsAdmin(): Promise<CreditsAdminUser[]> {
  const admin = createAdminClient();
  const [authUsers, { data: profiles }] = await Promise.all([
    listAllUsers(),
    admin.from("profiles").select("id, full_name, plan, credits"),
  ]);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p as { full_name: string | null; plan: AdminUser["plan"]; credits: number }])
  );

  return authUsers.map((u) => {
    const profile = profileById.get(u.id);
    return {
      id: u.id,
      name: profile?.full_name || u.email?.split("@")[0] || "Unnamed",
      email: u.email ?? "",
      plan: profile?.plan ?? "core",
      credits: profile?.credits ?? 0,
    };
  });
}

export async function getOverviewData() {
  const [signupSeries, usage, planDistribution, activityLog, systemJobs, { users }] = await Promise.all([
    getSignupSeries(),
    getUsageData(),
    getPlanDistribution(),
    getActivityLog(7),
    getSystemJobs(20),
    getAdminUsers(),
  ]);

  return {
    totalUsers: users.length,
    // Billing isn't wired up this pass — these stay honestly at zero rather
    // than fabricated numbers. See src/app/admin/revenue/page.tsx.
    activeTrials: 0,
    currentMrr: 0,
    previousMrr: 0,
    mrrGrowthPct: 0,
    churnRatePct: 0,
    previousChurnRatePct: 0,
    revenueSeries: last30Days().map((date) => ({ date, mrr: 0, newMrr: 0, churnedMrr: 0 })),
    signupSeries,
    usageSeries: usage.series,
    toolUsageShare: usage.share,
    planDistribution,
    activityLog,
    systemJobs,
    jobSuccessRatePct: computeJobSuccessRate(systemJobs),
  };
}
