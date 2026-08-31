import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICING_PLANS } from "@/lib/mock/pricing";
import { CANCELLATION_REASONS } from "@/lib/cancellation";
import type {
  ActivityLogEntry,
  AdminNicheChannel,
  AdminTeamMember,
  AdminToolKey,
  AdminUser,
  ApiEndpointHealth,
  ApiProvider,
  CreditsAdminUser,
  CreditsOverview,
  FeatureFlag,
  AdminUserStatus,
  PlanDistribution,
  PricingPlan,
  PromoCode,
  RevenueData,
  RevenueTransaction,
  SignupPoint,
  SystemJob,
  SystemJobStatus,
  SystemJobType,
  ToolTone,
  ToolUsageShare,
  UsagePoint,
} from "@/lib/types";

// Real, DB-backed replacements for src/lib/mock/admin.ts. Revenue/MRR/churn
// (getRevenueData below) is driven by Whop's webhook event log and the
// profiles.subscription_status columns from the 20260729120000_whop_billing
// migration -- real numbers, honestly zero until the Whop webhook is
// registered and the first event lands (see WHOP_WEBHOOK_SECRET).

const TOOL_LABELS: Record<AdminToolKey, string> = {
  bend: "Niche Bending",
  niches: "Niche Finder",
  transcripts: "Transcripts",
  downloader: "Downloader",
  mcp: "MCP",
  image: "Image Generator",
  video: "Video Generator",
  voiceover: "Voiceover Generator",
};

const TOOL_TONES: Record<AdminToolKey, ToolTone> = {
  bend: "violet",
  niches: "blue",
  transcripts: "amber",
  downloader: "green",
  mcp: "rose",
  image: "sky",
  video: "orange",
  voiceover: "green",
};

const PLAN_LABEL: Record<string, string> = { core: "Core", pro: "Pro", scale: "Scale" };
const PLAN_TONE: Record<string, ToolTone> = { core: "sky", pro: "blue", scale: "violet" };

const CANCELLATION_REASON_TONE: Record<string, ToolTone> = {
  switching: "sky",
  too_expensive: "amber",
  missing_features: "violet",
  technical_issues: "rose",
  bad_experience: "orange",
  other: "green",
};

// Subscriptions still collecting revenue (or in the past_due grace window) --
// see src/proxy.ts's PAST_DUE_GRACE_MS for why past_due keeps counting.
const PAYING_STATUSES = new Set(["active", "past_due"]);

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
  const byDay = new Map(
    days.map((d) => [d, { bend: 0, niches: 0, transcripts: 0, downloader: 0, mcp: 0, image: 0, video: 0, voiceover: 0 }])
  );
  const totals: Record<AdminToolKey, number> = {
    bend: 0,
    niches: 0,
    transcripts: 0,
    downloader: 0,
    mcp: 0,
    image: 0,
    video: 0,
    voiceover: 0,
  };

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

  return (["core", "pro", "scale"] as const).map((plan) => ({
    plan,
    label: PLAN_LABEL[plan],
    count: counts[plan] ?? 0,
    tone: PLAN_TONE[plan],
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

// subscription_status values (Polar's or Whop's vocabulary, per the check
// constraint) -> the admin dashboard's coarser status. "suspended" is never
// written here -- it's an admin-applied moderation flag the UsersTable
// toggles client-side only, unrelated to billing state.
function mapSubscriptionStatus(status: string | null): AdminUserStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  // canceled, incomplete, incomplete_expired, unpaid, paused, or no
  // subscription at all (still on the free-by-default core plan).
  return status ? "canceled" : "active";
}

// Window for "active right now" -- there's no websocket presence channel in
// this app, so "live" is approximated from real recency signals (a session
// starting or a tool actually running), not a fabricated online/offline dot.
const ACTIVE_NOW_WINDOW_MS = 5 * 60 * 1000;

export async function getAdminUsers(): Promise<{ users: AdminUser[]; nowIso: string; activeNowCount: number }> {
  const admin = createAdminClient();
  const [authUsers, { data: profiles }, { data: usageRows }, planDefs] = await Promise.all([
    listAllUsers(),
    admin.from("profiles").select("id, full_name, plan, subscription_status, subscription_period"),
    admin.from("usage_events").select("user_id, tool, created_at"),
    getPlanDefinitions(admin),
  ]);

  const priceByPlan = new Map(planDefs.map((p) => [p.id, p.price]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const usageByUser = new Map<
    string,
    { bends: number; transcripts: number; downloads: number; apiCalls: number; lastEventAt: string }
  >();

  for (const row of usageRows ?? []) {
    const bucket = usageByUser.get(row.user_id) ?? {
      bends: 0,
      transcripts: 0,
      downloads: 0,
      apiCalls: 0,
      lastEventAt: row.created_at,
    };
    if (row.tool === "bend") bucket.bends += 1;
    else if (row.tool === "transcripts") bucket.transcripts += 1;
    else if (row.tool === "downloader") bucket.downloads += 1;
    else if (row.tool === "mcp") bucket.apiCalls += 1;
    if (row.created_at > bucket.lastEventAt) bucket.lastEventAt = row.created_at;
    usageByUser.set(row.user_id, bucket);
  }

  const now = Date.now();
  let activeNowCount = 0;

  const users: AdminUser[] = authUsers.map((u) => {
    const profile = profileById.get(u.id) as
      | { full_name: string | null; plan: AdminUser["plan"]; subscription_status: string | null; subscription_period: string | null }
      | undefined;
    const usageEntry = usageByUser.get(u.id);
    const usage = {
      bends: usageEntry?.bends ?? 0,
      transcripts: usageEntry?.transcripts ?? 0,
      downloads: usageEntry?.downloads ?? 0,
      apiCalls: usageEntry?.apiCalls ?? 0,
    };
    const status = mapSubscriptionStatus(profile?.subscription_status ?? null);
    const price = priceByPlan.get(profile?.plan ?? "core");
    // Gate on the raw subscription status, not the display status above -- a
    // profile with no subscription at all also *displays* as "active" (free
    // access, nothing billed) and must not be counted as paying revenue.
    const mrr = PAYING_STATUSES.has(profile?.subscription_status ?? "") && price
      ? profile?.subscription_period === "yearly"
        ? Math.round(price.yearly / 12)
        : price.monthly
      : 0;

    // Most recent of "started a session" and "actually ran a tool" -- either
    // one is real evidence the account is in use, not just logged in once.
    const lastActiveAt = [u.last_sign_in_at, u.created_at, usageEntry?.lastEventAt]
      .filter((d): d is string => !!d)
      .reduce((latest, d) => (new Date(d).getTime() > new Date(latest).getTime() ? d : latest), new Date(0).toISOString());
    if (now - new Date(lastActiveAt).getTime() <= ACTIVE_NOW_WINDOW_MS) activeNowCount++;

    return {
      id: u.id,
      name: profile?.full_name || u.email?.split("@")[0] || "Unnamed",
      email: u.email ?? "",
      plan: profile?.plan ?? "core",
      status,
      mrr,
      signupDate: (u.created_at ?? new Date().toISOString()).slice(0, 10),
      lastActiveAt,
      country: "N/A",
      usage,
    };
  });

  return { users, nowIso: new Date().toISOString(), activeNowCount };
}

function mapJobStatus(status: string): SystemJobStatus {
  if (status === "failed") return "failed";
  if (status === "ready" || status === "sop_ready" || status === "complete" || status === "completed") return "success";
  if (status === "queued" || status === "opening_channel") return "queued";
  return "running";
}

export async function getSystemJobs(limit = 20): Promise<SystemJob[]> {
  const admin = createAdminClient();
  const [
    { data: bendJobs },
    { data: transcriptJobs },
    { data: downloadJobs },
    { data: videoJobs },
    { data: imageJobs },
    { data: voiceoverJobs },
    authUsers,
  ] = await Promise.all([
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
    admin
      .from("video_generations")
      .select("id, status, user_id, created_at, updated_at, raw_error_message")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("image_generations")
      .select("id, status, user_id, created_at, raw_error_message")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("voiceover_generations")
      .select("id, status, user_id, created_at, updated_at, raw_error_message")
      .order("created_at", { ascending: false })
      .limit(limit),
    listAllUsers(),
  ]);

  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? "N/A"]));

  function toDuration(status: string, createdAt: string, updatedAt: string): number | undefined {
    const settled = status === "failed" || status === "success" || status === "ready" || status === "sop_ready" || status === "complete" || status === "completed";
    return settled ? new Date(updatedAt).getTime() - new Date(createdAt).getTime() : undefined;
  }

  const jobs: SystemJob[] = [
    ...(bendJobs ?? []).map((j) => ({
      id: j.id,
      type: "niche-bend" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "N/A",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
    })),
    ...(transcriptJobs ?? []).map((j) => ({
      id: j.id,
      type: "transcript" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "N/A",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
    })),
    ...(downloadJobs ?? []).map((j) => ({
      id: j.id,
      type: "download" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "N/A",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
    })),
    ...(videoJobs ?? []).map((j) => ({
      id: j.id,
      type: "video-generation" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "N/A",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
      errorMessage: j.raw_error_message,
    })),
    ...(imageJobs ?? []).map((j) => ({
      id: j.id,
      type: "image-generation" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "N/A",
      startedAt: j.created_at,
      errorMessage: j.raw_error_message,
    })),
    ...(voiceoverJobs ?? []).map((j) => ({
      id: j.id,
      type: "voiceover-generation" as SystemJobType,
      status: mapJobStatus(j.status),
      userEmail: emailById.get(j.user_id) ?? "N/A",
      startedAt: j.created_at,
      durationMs: toDuration(j.status, j.created_at, j.updated_at),
      errorMessage: j.raw_error_message,
    })),
  ];

  return jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, limit);
}

export function computeJobSuccessRate(jobs: SystemJob[]): number {
  const settled = jobs.filter((j) => j.status === "success" || j.status === "failed");
  if (settled.length === 0) return 100;
  return Number(((settled.filter((j) => j.status === "success").length / settled.length) * 100).toFixed(1));
}

// Backed by health_checks, written every 5 min by /api/cron/health-check
// (see supabase/migrations/20260731120000_endpoint_health_tracking.sql).
// null (not 0) means no checks have landed yet -- distinct from "0% uptime".
export async function getUptimeStats(): Promise<{ uptimePct: number | null; totalChecks: number }> {
  const admin = createAdminClient();
  const since30 = new Date();
  since30.setUTCDate(since30.getUTCDate() - 29);

  const { data } = await admin.from("health_checks").select("ok").gte("created_at", since30.toISOString());
  const rows = data ?? [];
  if (rows.length === 0) return { uptimePct: null, totalChecks: 0 };

  const okCount = rows.filter((row) => row.ok).length;
  return { uptimePct: Number(((okCount / rows.length) * 100).toFixed(2)), totalChecks: rows.length };
}

// Backed by api_request_log, written by withApiLogging (src/lib/server/
// api-logging.ts) across the instrumented product/tool + MCP routes.
export async function getApiErrorRate(): Promise<{ errorRatePct: number | null; totalRequests: number }> {
  const admin = createAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await admin.from("api_request_log").select("is_error").gte("created_at", since24h);
  const rows = data ?? [];
  if (rows.length === 0) return { errorRatePct: null, totalRequests: 0 };

  const errorCount = rows.filter((row) => row.is_error).length;
  return { errorRatePct: Number(((errorCount / rows.length) * 100).toFixed(2)), totalRequests: rows.length };
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.floor(p * sortedValues.length));
  return sortedValues[index];
}

export async function getEndpointHealthToday(): Promise<ApiEndpointHealth[]> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data } = await admin
    .from("api_request_log")
    .select("endpoint, method, status, duration_ms")
    .gte("created_at", startOfDay.toISOString());

  const byEndpoint = new Map<string, { endpoint: string; method: string; durations: number[]; errors: number }>();

  for (const row of data ?? []) {
    const key = `${row.endpoint}::${row.method}`;
    const bucket =
      byEndpoint.get(key) ?? { endpoint: row.endpoint, method: row.method, durations: [] as number[], errors: 0 };
    bucket.durations.push(row.duration_ms);
    if (row.status >= 400) bucket.errors += 1;
    byEndpoint.set(key, bucket);
  }

  return [...byEndpoint.values()]
    .map((bucket) => {
      const sorted = [...bucket.durations].sort((a, b) => a - b);
      return {
        endpoint: bucket.endpoint,
        method: bucket.method,
        callsToday: bucket.durations.length,
        p50Ms: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        errorRatePct: Number(((bucket.errors / bucket.durations.length) * 100).toFixed(1)),
      };
    })
    .sort((a, b) => b.callsToday - a.callsToday);
}

// monthly_cost is an admin-entered budget figure, not pulled from any
// provider's billing API -- none of the integrated providers expose one
// here. `configured` just checks whether the referenced env var has a
// value set on this deployment, so a provider can be flagged as wired up
// or not without ever reading/exposing the secret itself.
export async function getApiProviders(): Promise<ApiProvider[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_providers")
    .select("id, name, category, env_var, website_url, notes, monthly_cost, currency, is_active, updated_at")
    .order("sort_order");

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    envVar: row.env_var,
    websiteUrl: row.website_url,
    notes: row.notes,
    monthlyCost: row.monthly_cost,
    currency: row.currency,
    isActive: row.is_active,
    configured: row.env_var ? !!process.env[row.env_var] : false,
    updatedAt: row.updated_at,
  }));
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

const PROMO_CODE_SELECT = "id, code, reward_type, reward_value, max_uses, used_count, expires_at, is_active, created_at";

export function mapPromoCodeRow(row: {
  id: string;
  code: string;
  reward_type: string;
  reward_value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}): PromoCode {
  return {
    id: row.id,
    code: row.code,
    rewardType: row.reward_type as PromoCode["rewardType"],
    rewardValue: row.reward_value,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getPromoCodes(): Promise<PromoCode[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("promo_codes").select(PROMO_CODE_SELECT).order("created_at", { ascending: false });

  return (data ?? []).map(mapPromoCodeRow);
}

const NICHE_CHANNEL_ADMIN_SELECT =
  "id, platform, channel_url, channel_title, avatar_url, subscriber_count, total_views, niche, is_faceless, faceless_confidence, faceless_category, complexity, viral_velocity_score, verified_at, created_at";

interface NicheChannelAdminRow {
  id: string;
  platform: AdminNicheChannel["platform"];
  channel_url: string;
  channel_title: string;
  avatar_url: string | null;
  subscriber_count: number;
  total_views: number;
  niche: string | null;
  is_faceless: boolean | null;
  faceless_confidence: number | null;
  faceless_category: AdminNicheChannel["facelessCategory"];
  complexity: AdminNicheChannel["complexity"];
  viral_velocity_score: number | null;
  verified_at: string | null;
  created_at: string;
}

export async function getNicheChannelsForAdmin(): Promise<AdminNicheChannel[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("niche_channels")
    .select(NICHE_CHANNEL_ADMIN_SELECT)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<NicheChannelAdminRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    channelUrl: row.channel_url,
    channelTitle: row.channel_title,
    avatarUrl: row.avatar_url,
    subscriberCount: row.subscriber_count,
    totalViews: row.total_views,
    niche: row.niche,
    isFaceless: row.is_faceless,
    facelessConfidence: row.faceless_confidence,
    facelessCategory: row.faceless_category,
    complexity: row.complexity,
    viralVelocityScore: row.viral_velocity_score,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
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
 * migration is applied and payment (Whop) is wired up.
 */
const PLAN_DEFINITION_SELECT =
  "id, name, info, price_monthly, price_yearly, recommended, monthly_only, cta, features, limits, sort_order";

export async function getPlanDefinitions(supabase: SupabaseClient): Promise<PricingPlan[]> {
  const { data } = await supabase.from("plan_definitions").select(PLAN_DEFINITION_SELECT).order("sort_order");
  const rows = (data as PlanDefinitionRow[]) ?? [];
  if (rows.length === 0) return PRICING_PLANS;
  return rows.map(planRowToPricingPlan);
}

export const PLAN_DEFINITIONS_CACHE_TAG = "plan-definitions";

/**
 * Cached read path for callers that don't need admin-fresh data, e.g. the
 * public pricing section, which every landing-page visitor triggers a fetch
 * from. Backed by Next's shared Data Cache (unstable_cache), so unlike a
 * plain in-process Map this stays consistent across serverless instances --
 * no split-brain where instance A shows a just-edited price and instance B
 * still has the old one. The 5-minute revalidate is a safety net; the write
 * path (PUT /api/admin/plan-definitions) calls revalidateTag on save so
 * admin edits show up immediately instead of waiting out the TTL. Falls
 * back to the source table on any cache-layer failure since unstable_cache
 * just re-invokes the function.
 */
export const getCachedPlanDefinitions = unstable_cache(
  async (): Promise<PricingPlan[]> => getPlanDefinitions(createAdminClient()),
  ["plan-definitions"],
  { tags: [PLAN_DEFINITIONS_CACHE_TAG], revalidate: 300 }
);

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

  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? "N/A"]));
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
        email: emailById.get(userId) ?? "N/A",
        plan: profile?.plan ?? "core",
        spent30d,
        balance: profile?.credits ?? 0,
      };
    });

  const recentTransactions = (recentTxRows ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: nameFor(row.user_id),
    userEmail: emailById.get(row.user_id) ?? "N/A",
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

interface WhopWebhookEventRow {
  id: string;
  type: string;
  created_at: string;
  // Shape mirrors @whop/sdk's webhook event types (payment.succeeded's `data`
  // is a Payment, refund.created's `data` is RefundCreatedWebhookEvent.Data)
  // -- the whole unwrapped event is stored as-is by
  // src/app/api/webhooks/whop/route.ts, so this stays loose rather than
  // re-declaring the SDK's types here.
  payload: { data?: Record<string, unknown> } | null;
}

// Whop's PaymentsAPI.BillingReasons values.
const BILLING_REASON_LABEL: Record<string, string> = {
  one_time: "Credit top-up",
  subscription_create: "New subscription",
  subscription_cycle: "Renewal",
  subscription_update: "Plan change",
  subscription: "Subscription",
  manual: "Manual charge",
};

// Whop reports amounts as decimals in the payment's currency (e.g. 10.43 for
// $10.43) -- no /100 conversion needed here.
function parseRevenueTransaction(row: WhopWebhookEventRow): RevenueTransaction | null {
  const data = row.payload?.data;
  if (!data) return null;

  if (row.type === "refund.created") {
    const payment = data.payment as { product?: { title?: string | null } | null } | null | undefined;
    return {
      id: row.id,
      type: "order.refunded",
      userName: "Unknown",
      userEmail: "N/A",
      itemLabel: payment?.product?.title ?? "Refund",
      billingReason: null,
      amount: -((data.amount as number | undefined) ?? 0),
      currency: ((data.currency as string | undefined) ?? "usd").toUpperCase(),
      createdAt: row.created_at,
    };
  }

  const user = data.user as { name?: string | null; email?: string | null } | null | undefined;
  const product = data.product as { title?: string | null } | null | undefined;
  const billingReason = data.billing_reason as string | null | undefined;
  const settlementAmount = (data.settlement_amount as number | undefined) ?? 0;

  return {
    id: row.id,
    type: "order.paid",
    userName: user?.name || user?.email || "Unknown",
    userEmail: user?.email ?? "N/A",
    itemLabel: product?.title ?? (data.membership ? "Subscription" : "Credits"),
    billingReason: billingReason ? (BILLING_REASON_LABEL[billingReason] ?? billingReason) : null,
    amount: settlementAmount,
    currency: ((data.currency as string | undefined) ?? "usd").toUpperCase(),
    createdAt: row.created_at,
  };
}

export async function getRevenueData(): Promise<RevenueData> {
  const admin = createAdminClient();
  const since30 = new Date();
  since30.setUTCDate(since30.getUTCDate() - 29);

  const [{ data: profiles }, planDefs, { data: cancellationRows }, { data: eventRows }] = await Promise.all([
    admin.from("profiles").select("plan, subscription_status, subscription_period"),
    getPlanDefinitions(admin),
    admin
      .from("cancellation_feedback")
      .select("reason, outcome, offer_shown, offer_accepted")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("whop_webhook_events")
      .select("id, type, payload, created_at")
      .in("type", ["payment.succeeded", "refund.created", "membership.activated", "membership.deactivated"])
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const priceByPlan = new Map(planDefs.map((p) => [p.id, p.price]));

  let mrr = 0;
  let activeSubscribers = 0;
  let trialingCount = 0;
  let pastDueCount = 0;
  const planBuckets: Record<string, { count: number; mrr: number }> = {
    core: { count: 0, mrr: 0 },
    pro: { count: 0, mrr: 0 },
    scale: { count: 0, mrr: 0 },
  };

  for (const row of profiles ?? []) {
    const status = row.subscription_status;
    if (status === "trialing") {
      trialingCount++;
      continue;
    }
    if (!PAYING_STATUSES.has(status ?? "")) continue;

    activeSubscribers++;
    if (status === "past_due") pastDueCount++;

    const price = priceByPlan.get(row.plan);
    const monthly = price ? (row.subscription_period === "yearly" ? price.yearly / 12 : price.monthly) : 0;
    mrr += monthly;
    const bucket = planBuckets[row.plan] ?? (planBuckets[row.plan] = { count: 0, mrr: 0 });
    bucket.count++;
    bucket.mrr += monthly;
  }

  const events = eventRows ?? [];
  const churnedLast30d = events.filter((e) => e.type === "membership.deactivated" && e.created_at >= since30.toISOString()).length;
  const newSubscribersLast30d = events.filter((e) => e.type === "membership.activated" && e.created_at >= since30.toISOString()).length;

  const days = last30Days();
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const row of events) {
    if (row.type !== "payment.succeeded" && row.type !== "refund.created") continue;
    const day = row.created_at.slice(0, 10);
    if (!byDay.has(day)) continue;
    const txn = parseRevenueTransaction(row);
    if (txn) byDay.set(day, (byDay.get(day) ?? 0) + txn.amount);
  }
  const dailySeries = days.map((date) => ({ date, collected: Math.round((byDay.get(date) ?? 0) * 100) / 100 }));
  const netCollectedLast30d = dailySeries.reduce((s, p) => s + p.collected, 0);

  const recentTransactions = events
    .filter((e) => e.type === "payment.succeeded" || e.type === "refund.created")
    .slice(0, 20)
    .map(parseRevenueTransaction)
    .filter((t): t is RevenueTransaction => t !== null);

  const cancellations = cancellationRows ?? [];
  const reasonCounts: Record<string, number> = {};
  for (const row of cancellations) {
    if (row.outcome !== "canceled") continue;
    reasonCounts[row.reason] = (reasonCounts[row.reason] ?? 0) + 1;
  }
  const cancellationBreakdown = CANCELLATION_REASONS.map((r) => ({
    reason: r.id,
    label: r.label,
    count: reasonCounts[r.id] ?? 0,
    tone: CANCELLATION_REASON_TONE[r.id],
  })).filter((entry) => entry.count > 0);

  const retentionOffersShown = cancellations.filter((r) => r.offer_shown).length;
  const retentionOffersAccepted = cancellations.filter((r) => r.offer_accepted).length;

  return {
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    arpu: activeSubscribers ? Math.round((mrr / activeSubscribers) * 100) / 100 : 0,
    activeSubscribers,
    trialingCount,
    pastDueCount,
    churnedLast30d,
    newSubscribersLast30d,
    churnRatePct: Number(((churnedLast30d / (activeSubscribers + churnedLast30d || 1)) * 100).toFixed(1)),
    netCollectedLast30d: Math.round(netCollectedLast30d * 100) / 100,
    planBreakdown: (["core", "pro", "scale"] as const).map((plan) => ({
      plan,
      label: PLAN_LABEL[plan],
      subscriberCount: planBuckets[plan].count,
      mrr: Math.round(planBuckets[plan].mrr),
      tone: PLAN_TONE[plan],
    })),
    dailySeries,
    recentTransactions,
    webhookConfigured: !!process.env.WHOP_WEBHOOK_SECRET,
    cancellationBreakdown,
    retentionOffersShown,
    retentionOfferAcceptRatePct: retentionOffersShown ? Number(((retentionOffersAccepted / retentionOffersShown) * 100).toFixed(1)) : 0,
  };
}

export async function getOverviewData() {
  const [signupSeries, usage, planDistribution, activityLog, systemJobs, { users }, creditsOverview, promoCodes, featureFlags, revenue] =
    await Promise.all([
      getSignupSeries(),
      getUsageData(),
      getPlanDistribution(),
      getActivityLog(7),
      getSystemJobs(20),
      getAdminUsers(),
      getCreditsOverview(),
      getPromoCodes(),
      getFeatureFlags(),
      getRevenueData(),
    ]);

  return {
    totalUsers: users.length,
    payingUsers: revenue.activeSubscribers,
    activeTrials: revenue.trialingCount,
    currentMrr: revenue.mrr,
    churnRatePct: revenue.churnRatePct,
    revenueDailySeries: revenue.dailySeries,
    signupSeries,
    usageSeries: usage.series,
    toolUsageShare: usage.share,
    planDistribution,
    activityLog,
    systemJobs,
    jobSuccessRatePct: computeJobSuccessRate(systemJobs),
    creditsOutstanding: creditsOverview.totalOutstanding,
    creditsSpentToday: creditsOverview.spentToday,
    creditsSpentLast7Days: creditsOverview.spentLast7Days,
    activePromoCodes: promoCodes.filter((c) => c.isActive).length,
    enabledFeatureFlags: featureFlags.filter((f) => f.enabled).length,
    totalFeatureFlags: featureFlags.length,
  };
}
