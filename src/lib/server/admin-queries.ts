import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopWebhookEnabled } from "@/lib/server/whop-sync";
import { findSubscriptionPlanByPlanId } from "@/lib/config/whop";
import { getWhopMoney } from "@/lib/server/whop-revenue";
import { PRICING_PLANS } from "@/lib/mock/pricing";
import { CANCELLATION_REASONS } from "@/lib/cancellation";
import { PAYMENT_FAILED_NOTICE_TYPE } from "@/lib/server/payment-failed";
import { JOB_TYPE_LABEL } from "@/components/admin/job-labels";
import { formatCurrency } from "@/lib/utils";
import type {
  ActivityLogEntry,
  AdminTeamMember,
  AdminToolKey,
  AdminUser,
  ApiEndpointHealth,
  ApiProvider,
  CreditsAdminUser,
  CreditsOverview,
  FailedPayment,
  FailedPaymentEmailStatus,
  FailedPaymentKind,
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

const PLAN_LABEL: Record<string, string> = { free: "Free", core: "Core", pro: "Pro", scale: "Scale" };
const PLAN_TONE: Record<string, ToolTone> = { free: "sky", core: "sky", pro: "blue", scale: "violet" };

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

/**
 * Users whose current subscription has actually been charged. A status alone
 * isn't money: a 100%-off promo leaves a membership "active" or "trialing"
 * with nothing ever billed, and a past payment on an older, canceled
 * membership (the owner's August test) doesn't make today's free one paid.
 * So a user counts only when the membership on their profile has at least
 * one payment above zero. Every Whop payment is logged with its membership
 * in whop_webhook_events, by the webhook or the 10-minute whop-sync cron.
 */
// Wrapped in React's cache(): one admin render often reaches this from
// several queries (the overview did four times), and it should cost one read.
const getPaidUserIds = cache(async (): Promise<Set<string>> => {
  const admin = createAdminClient();
  const [{ data: payments }, { data: profiles }] = await Promise.all([
    selectAllRows((from, to, opts) =>
      admin
        .from("whop_webhook_events")
        .select(
          "id, membership_id:payload->data->membership->>id, usd_total:payload->data->>usd_total, total:payload->data->>total, settlement_amount:payload->data->>settlement_amount",
          opts,
        )
        .eq("type", "payment.succeeded")
        .order("id")
        .range(from, to),
    ),
    selectAllRows((from, to, opts) =>
      admin.from("profiles").select("id, subscription_id", opts).not("subscription_id", "is", null).order("id").range(from, to),
    ),
  ]);

  const chargedMemberships = new Set<string>();
  for (const row of payments as { membership_id: string | null; usd_total: string | null; total: string | null; settlement_amount: string | null }[]) {
    const amount = Number(row.usd_total ?? row.total ?? row.settlement_amount ?? 0);
    if (row.membership_id && amount > 0) chargedMemberships.add(row.membership_id);
  }

  return new Set(
    (profiles as { id: string; subscription_id: string }[])
      .filter((p) => chargedMemberships.has(p.subscription_id))
      .map((p) => p.id),
  );
});

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

// Every auth account, read once per render (cache()) however many admin
// queries ask for it. GoTrue serves at most 1000 per page; the first page
// reports the total, so the rest are fetched side by side instead of one
// after another -- six sequential ~450ms pages at 5k accounts became two
// round trips.
const AUTH_PAGE_SIZE = 1000;
const listAllUsers = cache(async (): Promise<User[]> => {
  const admin = createAdminClient();
  const fetchPage = async (page: number) =>
    (await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })).data;

  const first = await fetchPage(1);
  const users: User[] = [...(first?.users ?? [])];
  if (users.length < AUTH_PAGE_SIZE) return users;

  const knownPages = first && "total" in first && first.total ? Math.ceil(first.total / AUTH_PAGE_SIZE) : 1;
  const rest = await Promise.all(Array.from({ length: Math.max(knownPages - 1, 0) }, (_, i) => fetchPage(i + 2)));
  for (const page of rest) users.push(...(page?.users ?? []));

  // Accounts created while the pages were in flight can push a full last
  // page; keep going one page at a time until a short one.
  let lastBatch = rest.length ? (rest[rest.length - 1]?.users.length ?? 0) : AUTH_PAGE_SIZE;
  for (let page = knownPages + 1; lastBatch === AUTH_PAGE_SIZE; page++) {
    const batch = (await fetchPage(page))?.users ?? [];
    users.push(...batch);
    lastBatch = batch.length;
  }
  return users;
});

/** Total auth accounts, without reading them: listUsers reports the total. */
async function countAuthUsers(): Promise<number> {
  const { data } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
  if (data && "total" in data && typeof data.total === "number") return data.total;
  return (await listAllUsers()).length;
}

/** Emails for a handful of accounts. A short list is looked up by id, which
 * beats paging through every account just to label a few rows. */
async function getEmailsById(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length > 25) return new Map((await listAllUsers()).map((u) => [u.id, u.email ?? "N/A"]));
  const admin = createAdminClient();
  const found = await Promise.all(
    unique.map(async (id) => [id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? "N/A"] as const),
  );
  return new Map(found);
}

// PostgREST caps every select at 1000 rows, which silently truncated the
// admin counts once profiles passed 1000 -- page through to the end. The
// first page also asks for the exact row count, so every remaining page is
// fetched in parallel rather than one round trip after another. The query
// must be ordered on a unique column so pages don't overlap, and must pass
// `opts` through to its .select() so the count can be requested.
const PAGE_SIZE = 1000;
type PageOpts = { count?: "exact" };
async function selectAllRows<T>(
  page: (from: number, to: number, opts: PageOpts) => PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>,
): Promise<{ data: T[] }> {
  const first = await page(0, PAGE_SIZE - 1, { count: "exact" });
  if (first.error) throw first.error;
  const rows: T[] = [...(first.data ?? [])];
  if (rows.length < PAGE_SIZE) return { data: rows };

  const total = first.count ?? 0;
  const offsets: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);
  const rest = await Promise.all(offsets.map((from) => page(from, from + PAGE_SIZE - 1, {})));
  let lastLength = rest.length ? PAGE_SIZE : rows.length;
  for (const result of rest) {
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    lastLength = result.data?.length ?? 0;
  }

  // Rows inserted after the count can leave a full last page; read on.
  for (let from = PAGE_SIZE * (offsets.length + 1); lastLength === PAGE_SIZE; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1, {});
    if (error) throw error;
    rows.push(...(data ?? []));
    lastLength = data?.length ?? 0;
  }
  return { data: rows };
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  subscription_period: string | null;
  credits: number;
}

/** Every profile, read once per render however many queries need it. */
const getAllProfiles = cache(async (): Promise<ProfileRow[]> => {
  const admin = createAdminClient();
  const { data } = await selectAllRows<ProfileRow>((from, to, opts) =>
    admin
      .from("profiles")
      .select("id, full_name, plan, subscription_status, subscription_period, credits", opts)
      .order("id")
      .range(from, to),
  );
  return data;
});

/** Only the profiles that have ever subscribed -- a handful, where the full
 * table is thousands. Every revenue and plan-mix figure lives in this set:
 * an account without a subscription status is on the free tier by definition. */
const getSubscriberProfiles = cache(async () => {
  const admin = createAdminClient();
  const { data } = await selectAllRows<Pick<ProfileRow, "id" | "plan" | "subscription_status" | "subscription_period">>(
    (from, to, opts) =>
      admin
        .from("profiles")
        .select("id, plan, subscription_status, subscription_period", opts)
        .not("subscription_status", "is", null)
        .order("id")
        .range(from, to),
  );
  return data;
});

const getAdminPlanDefinitions = cache(() => getPlanDefinitions(createAdminClient()));

/** A row count without the rows (HEAD + count=exact). */
function countQuery(table: string) {
  return createAdminClient().from(table).select("*", { count: "exact", head: true });
}
async function countRows(table: string, filter: (q: ReturnType<typeof countQuery>) => ReturnType<typeof countQuery> = (q) => q) {
  const { count, error } = await filter(countQuery(table));
  if (error) throw error;
  return count ?? 0;
}

export async function getSignupSeries(): Promise<SignupPoint[]> {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);

  const { data } = await selectAllRows((from, to, opts) =>
    admin.from("profiles").select("created_at", opts).gte("created_at", since.toISOString()).order("id").range(from, to),
  );

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

  const { data } = await selectAllRows((from, to, opts) =>
    admin.from("usage_events").select("tool, created_at", opts).gte("created_at", since.toISOString()).order("id").range(from, to),
  );

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

// Subscription states where the account is actually on its plan tier right
// now. profiles.plan defaults to "core" at signup and keeps its last paid
// value after a lapse (see displayPlan() below), so the tier only counts
// while one of these holds -- every other account is on the free tier.
const LIVE_PLAN_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function getPlanDistribution(): Promise<PlanDistribution[]> {
  // Only subscribers can be on a paid tier, so read those few and count the
  // rest as free rather than pulling every profile row.
  const [subscribers, totalProfiles, paidUserIds] = await Promise.all([
    getSubscriberProfiles(),
    countRows("profiles"),
    getPaidUserIds(),
  ]);

  const counts: Record<string, number> = { free: 0, core: 0, pro: 0, scale: 0 };
  let onPaidTier = 0;
  for (const row of subscribers) {
    if (!LIVE_PLAN_STATUSES.has(row.subscription_status ?? "") || !paidUserIds.has(row.id)) continue;
    const tier = row.plan ?? "core";
    counts[tier] = (counts[tier] ?? 0) + 1;
    onPaidTier++;
  }
  counts.free = Math.max(totalProfiles - onPaidTier, 0);

  return (["free", "core", "pro", "scale"] as const).map((plan) => ({
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
function mapSubscriptionStatus(status: string | null, paid: boolean): AdminUserStatus {
  // Never charged (a 100%-off promo, the owner's own test membership): the
  // admin treats it as a free account, whatever state Whop holds it in.
  if (!paid) return "free";
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  // canceled, incomplete, incomplete_expired, unpaid, paused all mean a
  // subscription existed once; no status at all means the account has never
  // subscribed -- an admin credit grant doesn't change that, so it must not
  // read as "active" (see displayPlan() below for the matching plan-id fix).
  return status ? "canceled" : "free";
}

// profiles.plan defaults to "core" at signup and keeps its last paid value
// after a subscription lapses (see migrations/20260716120001_profiles.sql
// and whop-sync.ts's cancellation handler) -- it does NOT mean the account
// is or ever was actually paying. An account with no subscription_status at
// all has never subscribed, including one that only ever received an admin
// credit grant (adjustCreditsAsAdmin only touches profiles.credits), so it
// must display as having no plan rather than the default "core" id.
function displayPlan(
  profile: { plan: string | null; subscription_status: string | null } | null | undefined,
  paid: boolean,
): AdminUser["plan"] {
  // Only a charged subscription makes a paid tier; see getPaidUserIds().
  if (!paid || !profile?.subscription_status) return "free";
  return (profile.plan as AdminUser["plan"] | null) ?? "core";
}

// Window for "active right now" -- there's no websocket presence channel in
// this app, so "live" is approximated from real recency signals (a session
// starting or a tool actually running), not a fabricated online/offline dot.
const ACTIVE_NOW_WINDOW_MS = 5 * 60 * 1000;

export async function getAdminUsers(): Promise<{ users: AdminUser[]; nowIso: string; activeNowCount: number }> {
  const admin = createAdminClient();
  const [authUsers, profiles, { data: usageRows }, planDefs, paidUserIds] = await Promise.all([
    listAllUsers(),
    getAllProfiles(),
    selectAllRows((from, to, opts) =>
      admin.from("usage_events").select("user_id, tool, created_at", opts).order("id").range(from, to),
    ),
    getAdminPlanDefinitions(),
    getPaidUserIds(),
  ]);

  const priceByPlan = new Map(planDefs.map((p) => [p.id, p.price]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
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
      | { full_name: string | null; plan: string | null; subscription_status: string | null; subscription_period: string | null }
      | undefined;
    const usageEntry = usageByUser.get(u.id);
    const usage = {
      bends: usageEntry?.bends ?? 0,
      transcripts: usageEntry?.transcripts ?? 0,
      downloads: usageEntry?.downloads ?? 0,
      apiCalls: usageEntry?.apiCalls ?? 0,
    };
    const paid = paidUserIds.has(u.id);
    const status = mapSubscriptionStatus(profile?.subscription_status ?? null, paid);
    const price = priceByPlan.get((profile?.plan as "core" | "pro" | "scale" | null) ?? "core");
    // Gate on the raw subscription status, not the display status above -- a
    // profile with no subscription at all also *displays* as "active" (free
    // access, nothing billed) and must not be counted as paying revenue.
    // Nor must a promo membership that has never been charged.
    const mrr = PAYING_STATUSES.has(profile?.subscription_status ?? "") && paid && price
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
      plan: displayPlan(profile, paid),
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

/** A job still queued or running this long after it started has silently
 * died (a webhook never came, a worker crashed): the user is left looking at
 * a spinner, which is a failure even though nothing marked it as one. Long
 * clipping runs finish well inside this. */
const STUCK_AFTER_MS = 60 * 60 * 1000;

/** One row per tool table the queue reads. `error` lists the columns to try,
 * the raw provider detail first since the user-facing message is generic. */
const JOB_SOURCES: {
  table: string;
  type: SystemJobType;
  columns: string;
  error: string[];
  source?: string;
}[] = [
  { table: "niche_bend_jobs", type: "niche-bend", columns: "source_url, error_message, updated_at", error: ["error_message"], source: "source_url" },
  { table: "transcripts", type: "transcript", columns: "source_url, error_message, updated_at", error: ["error_message"], source: "source_url" },
  { table: "downloads", type: "download", columns: "source_url, error_message, updated_at", error: ["error_message"], source: "source_url" },
  { table: "clip_projects", type: "clipping", columns: "source_url, error_message, updated_at", error: ["error_message"], source: "source_url" },
  { table: "creator_analyses", type: "creator-analysis", columns: "source_url, error_message, updated_at", error: ["error_message"], source: "source_url" },
  { table: "niche_reports", type: "niche-report", columns: "platform, error_message, updated_at", error: ["error_message"] },
  { table: "video_generations", type: "video-generation", columns: "prompt, error_message, raw_error_message, updated_at", error: ["raw_error_message", "error_message"], source: "prompt" },
  { table: "image_generations", type: "image-generation", columns: "prompt, error_message, raw_error_message", error: ["raw_error_message", "error_message"], source: "prompt" },
  { table: "voiceover_generations", type: "voiceover-generation", columns: "title, error_message, raw_error_message, updated_at", error: ["raw_error_message", "error_message"], source: "title" },
];

/** The latest jobs from every tool, newest first. Each table is read with the
 * same `limit` so a quiet tool still shows up before the overall cut. */
export async function getSystemJobs(limit = 20): Promise<SystemJob[]> {
  const admin = createAdminClient();
  const results = await Promise.all(
    JOB_SOURCES.map((src) =>
      admin
        .from(src.table)
        .select(`id, status, user_id, created_at, ${src.columns}`)
        .order("created_at", { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) console.error(`[admin] job queue: ${src.table}`, error.message);
          return (data ?? []) as unknown as Record<string, string | null>[];
        })
    )
  );

  // Cut to the newest `limit` first, then label only those rows' owners.
  const newest = JOB_SOURCES.flatMap((src, i) => results[i].map((row) => ({ src, row })))
    .sort((a, b) => new Date(b.row.created_at as string).getTime() - new Date(a.row.created_at as string).getTime())
    .slice(0, limit);
  const emailById = await getEmailsById(newest.map(({ row }) => row.user_id as string));
  const now = Date.now();

  return newest.map(({ src, row }): SystemJob => {
    const createdAt = row.created_at as string;
    let status = mapJobStatus(row.status ?? "");
    if ((status === "running" || status === "queued") && now - new Date(createdAt).getTime() > STUCK_AFTER_MS) status = "stuck";
    const settled = status === "success" || status === "failed";
    const errorMessage = src.error.map((col) => row[col]).find((v) => v && v.trim()) ?? null;
    return {
      id: row.id as string,
      type: src.type,
      status,
      userEmail: emailById.get(row.user_id as string) ?? "N/A",
      startedAt: createdAt,
      durationMs: settled && row.updated_at ? new Date(row.updated_at).getTime() - new Date(createdAt).getTime() : undefined,
      errorMessage,
      source: src.source ? row[src.source] : null,
    };
  });
}

/** Stuck jobs count against the rate: the user never got a result. */
export function computeJobSuccessRate(jobs: SystemJob[]): number {
  const settled = jobs.filter((j) => j.status !== "running" && j.status !== "queued");
  if (settled.length === 0) return 100;
  return Number(((settled.filter((j) => j.status === "success").length / settled.length) * 100).toFixed(1));
}

// Backed by health_checks, written every 5 min by /api/cron/health-check
// (see supabase/migrations/20260731120000_endpoint_health_tracking.sql).
// null (not 0) means no checks have landed yet -- distinct from "0% uptime".
export async function getUptimeStats(): Promise<{ uptimePct: number | null; totalChecks: number }> {
  const since30 = new Date();
  since30.setUTCDate(since30.getUTCDate() - 29);
  const since = since30.toISOString();

  // Counted in the database: 30 days of 5-minute checks is ~8,600 rows, and
  // reading them used to stop at PostgREST's 1000-row cap.
  const [totalChecks, okCount] = await Promise.all([
    countRows("health_checks", (q) => q.gte("created_at", since)),
    countRows("health_checks", (q) => q.gte("created_at", since).eq("ok", true)),
  ]);
  if (totalChecks === 0) return { uptimePct: null, totalChecks: 0 };
  return { uptimePct: Number(((okCount / totalChecks) * 100).toFixed(2)), totalChecks };
}

// Backed by api_request_log, written by withApiLogging (src/lib/server/
// api-logging.ts) across the instrumented product/tool + MCP routes.
export async function getApiErrorRate(): Promise<{ errorRatePct: number | null; totalRequests: number }> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalRequests, errorCount] = await Promise.all([
    countRows("api_request_log", (q) => q.gte("created_at", since24h)),
    countRows("api_request_log", (q) => q.gte("created_at", since24h).eq("is_error", true)),
  ]);
  if (totalRequests === 0) return { errorRatePct: null, totalRequests: 0 };
  return { errorRatePct: Number(((errorCount / totalRequests) * 100).toFixed(2)), totalRequests };
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

  const { data } = await selectAllRows((from, to, opts) =>
    admin
      .from("api_request_log")
      .select("endpoint, method, status, duration_ms", opts)
      .gte("created_at", startOfDay.toISOString())
      .order("id")
      .range(from, to),
  );

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
 * plan_definitions has no client RLS policy, so pass the service-role
 * client — a cookie-scoped client reads zero rows and silently gets the
 * PRICING_PLANS fallback.
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

  const [authUsers, profiles, { data: recentTxRows }, { data: ledger30Rows }, paidUserIds] = await Promise.all([
    listAllUsers(),
    getAllProfiles(),
    admin
      .from("credit_transactions")
      .select("id, user_id, amount, feature, action_key, granted_by, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    // Paged: a busy month passes PostgREST's 1000-row cap.
    selectAllRows((from, to, opts) =>
      admin
        .from("credit_transactions")
        .select("user_id, amount, action_key, created_at", opts)
        .gte("created_at", since30.toISOString())
        .order("id")
        .range(from, to),
    ),
    getPaidUserIds(),
  ]);

  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? "N/A"]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p as { full_name: string | null; plan: string | null; subscription_status: string | null; credits: number },
    ])
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
        plan: displayPlan(profile, paidUserIds.has(userId)),
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
  // Same reads as getCreditsOverview -- cache() makes the page pay once.
  const [authUsers, profiles, paidUserIds] = await Promise.all([listAllUsers(), getAllProfiles(), getPaidUserIds()]);

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p as { full_name: string | null; plan: string | null; subscription_status: string | null; credits: number },
    ])
  );

  return authUsers.map((u) => {
    const profile = profileById.get(u.id);
    return {
      id: u.id,
      name: profile?.full_name || u.email?.split("@")[0] || "Unnamed",
      email: u.email ?? "",
      plan: displayPlan(profile, paidUserIds.has(u.id)),
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
  // Webhook payloads carry settlement_amount; a payment read back from
  // Whop's API by a reconcile sweep doesn't, but has the same figure as its
  // USD total.
  const settlementAmount =
    (data.settlement_amount as number | undefined) ??
    (data.usd_total as number | undefined) ??
    (data.total as number | undefined) ??
    0;
  // Name the plan from our own config: Whop product titles go stale (Core's
  // still reads "legacy $19" after the move to $25).
  const planId = (data.plan as { id?: string } | null | undefined)?.id;
  const plan = planId ? findSubscriptionPlanByPlanId(planId) : null;
  const planLabel = plan ? `${PLAN_LABEL[plan.planId]}, ${plan.period}` : null;

  return {
    id: row.id,
    type: "order.paid",
    userName: user?.name || user?.email || "Unknown",
    userEmail: user?.email ?? "N/A",
    itemLabel: planLabel ?? product?.title ?? (data.membership ? "Subscription" : "Credits"),
    billingReason: billingReason ? (BILLING_REASON_LABEL[billingReason] ?? billingReason) : null,
    amount: settlementAmount,
    currency: ((data.currency as string | undefined) ?? "usd").toUpperCase(),
    createdAt: row.created_at,
  };
}

/**
 * Subscribers, MRR and the per-plan split, from our own profiles. Only the
 * handful of profiles that ever subscribed are read: an account without a
 * subscription status can't be paying. Shared by the overview (which needs
 * just these figures, not Whop's) and the revenue page.
 */
const getSubscriptionSummary = cache(async () => {
  const [subscribers, planDefs, paidUserIds] = await Promise.all([
    getSubscriberProfiles(),
    getAdminPlanDefinitions(),
    getPaidUserIds(),
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

  for (const row of subscribers) {
    // Accounts that never paid (promo memberships, the owner's own test
    // trial) aren't subscribers in any of these figures.
    if (!paidUserIds.has(row.id)) continue;
    const status = row.subscription_status;
    if (status === "trialing") {
      trialingCount++;
      continue;
    }
    if (!PAYING_STATUSES.has(status ?? "")) continue;

    activeSubscribers++;
    if (status === "past_due") pastDueCount++;

    const plan = row.plan ?? "core";
    const price = priceByPlan.get(plan as PricingPlan["id"]);
    const monthly = price ? (row.subscription_period === "yearly" ? price.yearly / 12 : price.monthly) : 0;
    mrr += monthly;
    const bucket = planBuckets[plan] ?? (planBuckets[plan] = { count: 0, mrr: 0 });
    bucket.count++;
    bucket.mrr += monthly;
  }

  return { mrr, activeSubscribers, trialingCount, pastDueCount, planBuckets, paidUserIds };
});

const FAILED_PAYMENT_KIND: Record<string, FailedPaymentKind> = {
  subscription_cycle: "renewal",
  subscription: "renewal",
  subscription_update: "renewal",
  subscription_create: "new_signup",
  one_time: "credit_pack",
};

interface FailedPaymentData {
  id?: string;
  billing_reason?: string | null;
  metadata?: { user_id?: unknown } | null;
  membership?: { id?: string } | null;
  plan?: { id?: string } | null;
  user?: { name?: string | null; email?: string | null } | null;
  usd_total?: number | null;
  total?: number | null;
  failure_message?: string | null;
  decline_code?: string | null;
  payments_failed?: number | null;
}

/**
 * payment.failed deliveries from the last 90 days. Whop sends one per
 * attempt, reusing the payment id, so rows collapse to the latest attempt
 * per payment. A failure counts as recovered once a payment.succeeded on the
 * same membership, or by the same user, is logged after it (by the webhook or
 * the sync cron) -- a declined checkout retried successfully often lands on a
 * fresh membership.
 */
export async function getFailedPayments(): Promise<FailedPayment[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: failedRows, error }, { data: noticeRows }, { data: successRows }] = await Promise.all([
    admin
      .from("whop_webhook_events")
      .select("id, payload, created_at")
      .eq("type", "payment.failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("whop_webhook_events")
      .select("payment_id:payload->data->>id, status:payload->data->>status")
      .eq("type", PAYMENT_FAILED_NOTICE_TYPE)
      .gte("created_at", since)
      .limit(1000),
    admin
      .from("whop_webhook_events")
      .select("membership_id:payload->data->membership->>id, user_id:payload->data->metadata->>user_id, created_at")
      .eq("type", "payment.succeeded")
      .gte("created_at", since)
      .limit(5000),
  ]);
  if (error) throw error;

  const latestByPayment = new Map<string, { data: FailedPaymentData; createdAt: string }>();
  for (const row of failedRows ?? []) {
    const data = (row.payload as { data?: FailedPaymentData } | null)?.data;
    if (!data?.id || latestByPayment.has(data.id)) continue; // rows are newest first
    latestByPayment.set(data.id, { data, createdAt: row.created_at });
  }
  if (latestByPayment.size === 0) return [];

  const emailStatus = new Map<string, FailedPaymentEmailStatus>();
  for (const row of (noticeRows ?? []) as { payment_id: string | null; status: string | null }[]) {
    if (row.payment_id && (row.status === "sent" || row.status === "failed" || row.status === "sending")) {
      emailStatus.set(row.payment_id, row.status);
    }
  }

  // Latest successful payment per membership and per user, keyed "m:<id>" / "u:<id>".
  const lastSuccess = new Map<string, string>();
  const noteSuccess = (key: string, at: string) => {
    const prev = lastSuccess.get(key);
    if (!prev || at > prev) lastSuccess.set(key, at);
  };
  for (const row of (successRows ?? []) as { membership_id: string | null; user_id: string | null; created_at: string }[]) {
    if (row.membership_id) noteSuccess(`m:${row.membership_id}`, row.created_at);
    if (row.user_id) noteSuccess(`u:${row.user_id}`, row.created_at);
  }

  const userIdOf = (data: FailedPaymentData) =>
    typeof data.metadata?.user_id === "string" ? data.metadata.user_id : null;
  const userIds = [...latestByPayment.values()].map((v) => userIdOf(v.data)).filter((id): id is string => !!id);
  const [emails, { data: profiles }] = await Promise.all([
    getEmailsById(userIds),
    userIds.length
      ? admin.from("profiles").select("id, full_name").in("id", [...new Set(userIds)])
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return [...latestByPayment.entries()].map(([paymentId, { data, createdAt }]) => {
    const userId = userIdOf(data);
    const email = (userId && emails.get(userId)) || data.user?.email || "N/A";
    const name = (userId && nameById.get(userId)) || data.user?.name || (email !== "N/A" ? email : "Unknown");
    const plan = data.plan?.id ? findSubscriptionPlanByPlanId(data.plan.id) : null;
    const membershipId = data.membership?.id;
    const paidAfter = (key: string | null) => {
      const at = key ? lastSuccess.get(key) : undefined;
      return !!at && at > createdAt;
    };
    return {
      paymentId,
      userId,
      userName: name,
      userEmail: email,
      kind: FAILED_PAYMENT_KIND[data.billing_reason ?? ""] ?? "other",
      planLabel: plan ? `${PLAN_LABEL[plan.planId]}, ${plan.period}` : null,
      amount: data.usd_total ?? data.total ?? 0,
      reason: data.failure_message || data.decline_code || null,
      attempts: Math.max(data.payments_failed ?? 1, 1),
      failedAt: createdAt,
      recovered: paidAfter(membershipId ? `m:${membershipId}` : null) || paidAfter(userId ? `u:${userId}` : null),
      emailStatus: emailStatus.get(paymentId) ?? "not_sent",
    };
  });
}

export async function getRevenueData(): Promise<RevenueData> {
  const admin = createAdminClient();
  const since30 = new Date();
  since30.setUTCDate(since30.getUTCDate() - 29);
  const days = last30Days();

  // Whop's API runs alongside the database reads rather than after them.
  // Money comes from Whop itself whenever Whop answers; the webhook rows
  // below are only the fallback.
  const [summary, { data: cancellationRows }, { data: eventRows }, webhookEnabled, whopMoney, failedPayments] = await Promise.all([
    getSubscriptionSummary(),
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
    getWhopWebhookEnabled(),
    getWhopMoney(days).catch((error) => {
      console.error("[admin/revenue] Whop API unavailable, falling back to webhook rows:", error);
      return null;
    }),
    getFailedPayments().catch((error) => {
      console.error("[admin/revenue] Failed payments unavailable:", error);
      return [] as FailedPayment[];
    }),
  ]);
  const { mrr, activeSubscribers, trialingCount, pastDueCount, planBuckets, paidUserIds } = summary;

  // A payment can be logged twice: once by a reconcile sweep (while the
  // webhook was down) and again if Whop's delivery lands later. Keep one row
  // per Whop object, by type and the object's own id.
  const seenObjects = new Set<string>();
  const events = (eventRows ?? []).filter((row) => {
    const objectId = (row.payload as { data?: { id?: unknown } } | null)?.data?.id;
    if (typeof objectId !== "string") return true;
    const key = `${row.type}:${objectId}`;
    if (seenObjects.has(key)) return false;
    seenObjects.add(key);
    return true;
  });
  const byPayer = (e: (typeof events)[number]) => {
    const userId = (e.payload as { data?: { metadata?: { user_id?: unknown } } } | null)?.data?.metadata?.user_id;
    return typeof userId === "string" && paidUserIds.has(userId);
  };
  const recent = (e: (typeof events)[number]) => e.created_at >= since30.toISOString();
  const churnedLast30d = events.filter((e) => e.type === "membership.deactivated" && recent(e) && byPayer(e)).length;
  const newSubscribersLast30d = events.filter((e) => e.type === "membership.activated" && recent(e) && byPayer(e)).length;

  const byDay = new Map(days.map((d) => [d, 0]));
  for (const row of events) {
    if (row.type !== "payment.succeeded" && row.type !== "refund.created") continue;
    const day = row.created_at.slice(0, 10);
    if (!byDay.has(day)) continue;
    const txn = parseRevenueTransaction(row);
    if (txn) byDay.set(day, (byDay.get(day) ?? 0) + txn.amount);
  }
  const webhookSeries = days.map((date) => ({ date, collected: Math.round((byDay.get(date) ?? 0) * 100) / 100 }));
  const dailySeries = whopMoney?.dailySeries ?? webhookSeries;
  const netCollectedLast30d = whopMoney?.netLast30d ?? webhookSeries.reduce((s, p) => s + p.collected, 0);

  const recentTransactions = whopMoney?.transactions ?? events
    .filter((e) => e.type === "payment.succeeded" || e.type === "refund.created")
    .slice(0, 100)
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
    whopBalance: whopMoney?.balance ?? null,
    moneySource: whopMoney ? "whop" : "webhooks",
    planBreakdown: (["core", "pro", "scale"] as const).map((plan) => ({
      plan,
      label: PLAN_LABEL[plan],
      subscriberCount: planBuckets[plan].count,
      mrr: Math.round(planBuckets[plan].mrr),
      tone: PLAN_TONE[plan],
    })),
    dailySeries,
    recentTransactions,
    failedPayments,
    webhookConfigured: !!process.env.WHOP_WEBHOOK_SECRET,
    webhookEnabled,
    cancellationBreakdown,
    retentionOffersShown,
    retentionOfferAcceptRatePct: retentionOffersShown ? Number(((retentionOffersAccepted / retentionOffersShown) * 100).toFixed(1)) : 0,
  };
}

/** Credits held across every balance. Nearly every account sits at zero, so
 * only the non-zero balances are read. */
async function getCreditsOutstanding(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await selectAllRows<{ credits: number }>((from, to, opts) =>
    admin.from("profiles").select("id, credits", opts).neq("credits", 0).order("id").range(from, to),
  );
  return data.reduce((sum, row) => sum + (row.credits ?? 0), 0);
}

/** Credits charged since UTC midnight. */
async function getCreditsSpentToday(): Promise<number> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data } = await selectAllRows<{ amount: number }>((from, to, opts) =>
    admin
      .from("credit_transactions")
      .select("id, amount", opts)
      .lt("amount", 0)
      .gte("created_at", startOfDay.toISOString())
      .order("id")
      .range(from, to),
  );
  return data.reduce((sum, row) => sum - row.amount, 0);
}

/**
 * Exactly what the overview shows, each figure from its cheapest source:
 * counts instead of row reads, the few subscriber profiles instead of every
 * profile, and no Whop API call (MRR and subscriber counts come from our own
 * tables, as they always did). It used to assemble the users, credits and
 * revenue pages' full datasets just to read a handful of numbers off them.
 */
export async function getOverviewData() {
  const [
    totalUsers,
    signupSeries,
    usage,
    planDistribution,
    activityLog,
    systemJobs,
    subscriptions,
    creditsOutstanding,
    creditsSpentToday,
    activePromoCodes,
    enabledFeatureFlags,
  ] = await Promise.all([
    countAuthUsers(),
    getSignupSeries(),
    getUsageData(),
    getPlanDistribution(),
    getActivitySources(),
    getSystemJobs(20),
    getSubscriptionSummary(),
    getCreditsOutstanding(),
    getCreditsSpentToday(),
    countRows("promo_codes", (q) => q.eq("is_active", true)),
    countRows("feature_flags", (q) => q.eq("enabled", true)),
  ]);

  return {
    totalUsers,
    payingUsers: subscriptions.activeSubscribers,
    activeTrials: subscriptions.trialingCount,
    currentMrr: Math.round(subscriptions.mrr),
    signupSeries,
    usageSeries: usage.series,
    toolUsageShare: usage.share,
    planDistribution,
    activityLog: mergeActivity(activityLog, systemJobs),
    systemJobs,
    jobSuccessRatePct: computeJobSuccessRate(systemJobs),
    creditsOutstanding,
    creditsSpentToday,
    activePromoCodes,
    enabledFeatureFlags,
  };
}

// ---------------------------------------------------------------------------
// The sidebar status card (src/lib/server/admin-pulse.ts). It refreshes every
// few minutes while an admin tab is open, so these read counts and a handful
// of columns -- never the rows a page would.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export interface JobHealth {
  /** Jobs that reached an end state (stuck counts as one: the user got nothing). */
  settled: number;
  failed: number;
  stuck: number;
  /** The tool with the most failed + stuck jobs, if any. */
  worstType: SystemJobType | null;
}

/** Every tool's jobs from the last 24 hours. Older stuck rows are left out:
 * one stuck since last week has already been seen on the System page. */
export async function getJobHealth24h(): Promise<JobHealth> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const results = await Promise.all(
    JOB_SOURCES.map((src) =>
      admin
        .from(src.table)
        .select("status, created_at")
        .gte("created_at", since)
        .limit(1000)
        .then(({ data, error }) => {
          if (error) console.error(`[admin] pulse: ${src.table}`, error.message);
          return (data ?? []) as { status: string | null; created_at: string }[];
        })
    )
  );

  const now = Date.now();
  let settled = 0;
  let failed = 0;
  let stuck = 0;
  const problems = new Map<SystemJobType, number>();
  JOB_SOURCES.forEach((src, i) => {
    for (const row of results[i]) {
      const status = mapJobStatus(row.status ?? "");
      if (status === "success") {
        settled++;
        continue;
      }
      const isStuck = status !== "failed" && now - new Date(row.created_at).getTime() > STUCK_AFTER_MS;
      if (status !== "failed" && !isStuck) continue; // still in flight
      settled++;
      if (isStuck) stuck++;
      else failed++;
      problems.set(src.type, (problems.get(src.type) ?? 0) + 1);
    }
  });

  const worstType = [...problems.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { settled, failed, stuck, worstType };
}

/** [last 7 days, the 7 before] for signups, tool runs and first payments. */
export async function getWeekOverWeekCounts(): Promise<{
  signups: [number, number];
  runs: [number, number];
  newPaying: [number, number];
}> {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY_MS).toISOString();
  const twoWeeksAgo = new Date(now - 14 * DAY_MS).toISOString();

  const [signupsNow, signupsBefore, runsNow, runsBefore, { data: paidRows }] = await Promise.all([
    countRows("profiles", (q) => q.gte("created_at", weekAgo)),
    countRows("profiles", (q) => q.gte("created_at", twoWeeksAgo).lt("created_at", weekAgo)),
    countRows("usage_events", (q) => q.gte("created_at", weekAgo)),
    countRows("usage_events", (q) => q.gte("created_at", twoWeeksAgo).lt("created_at", weekAgo)),
    // A subscription's first charge. One row per payment id: the webhook and
    // the sync cron can both log the same payment.
    createAdminClient()
      .from("whop_webhook_events")
      .select("payment_id:payload->data->>id, created_at")
      .eq("type", "payment.succeeded")
      .eq("payload->data->>billing_reason", "subscription_create")
      .gte("created_at", twoWeeksAgo)
      .limit(1000),
  ]);

  const paidNow = new Set<string>();
  const paidBefore = new Set<string>();
  for (const row of (paidRows ?? []) as { payment_id: string | null; created_at: string }[]) {
    if (!row.payment_id) continue;
    (row.created_at >= weekAgo ? paidNow : paidBefore).add(row.payment_id);
  }

  return {
    signups: [signupsNow, signupsBefore],
    runs: [runsNow, runsBefore],
    newPaying: [paidNow.size, paidBefore.size],
  };
}

/** The newest uptime probe (/api/cron/health-check, every 5 minutes). */
export async function getLatestHealthCheck(): Promise<{ ok: boolean; createdAt: string } | null> {
  const { data } = await createAdminClient()
    .from("health_checks")
    .select("ok, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { ok: data.ok, createdAt: data.created_at } : null;
}

// ---------------------------------------------------------------------------
// The overview's activity feed. activity_log alone only ever holds affiliate
// waitlist joins, so the feed is assembled from what actually happens: new
// accounts, payments, jobs that failed, plus whatever activity_log has. A few
// of each, so no single kind (7K signups in a day) crowds out the rest.
// ---------------------------------------------------------------------------

const FEED_PER_SOURCE = 3;

/** Signups, payments and activity_log rows. Failed jobs are folded in by
 * mergeActivity from the job list the overview already reads. */
async function getActivitySources(): Promise<ActivityLogEntry[]> {
  const admin = createAdminClient();
  const [logged, { data: profiles }, { data: payments }] = await Promise.all([
    getActivityLog(FEED_PER_SOURCE),
    admin.from("profiles").select("id, full_name, created_at").order("created_at", { ascending: false }).limit(FEED_PER_SOURCE),
    admin
      .from("whop_webhook_events")
      .select(
        "id, type, created_at, amount:payload->data->>usd_total, email:payload->data->user->>email, name:payload->data->user->>name, plan:payload->data->plan->>id"
      )
      .in("type", ["payment.succeeded", "payment.failed"])
      .order("created_at", { ascending: false })
      .limit(FEED_PER_SOURCE),
  ]);

  const emails = await getEmailsById((profiles ?? []).map((p) => p.id as string));
  const signups = (profiles ?? []).map((p): ActivityLogEntry => {
    const email = emails.get(p.id as string) ?? "N/A";
    return {
      id: `signup-${p.id}`,
      type: "user",
      message: `${(p.full_name as string | null)?.trim() || email} signed up`,
      actor: email,
      timestamp: p.created_at as string,
    };
  });

  type PaymentRow = { id: string; type: string; created_at: string; amount: string | null; email: string | null; name: string | null; plan: string | null };
  const billing = ((payments ?? []) as PaymentRow[]).map((row): ActivityLogEntry => {
    const who = row.name?.trim() || row.email || "A customer";
    const amount = row.amount ? formatCurrency(Number(row.amount)) : null;
    const plan = row.plan ? findSubscriptionPlanByPlanId(row.plan) : null;
    const paid = row.type === "payment.succeeded";
    return {
      id: `payment-${row.id}`,
      type: "billing",
      message: paid ? `${who} paid${amount ? ` ${amount}` : ""}` : `${who}'s payment was declined${amount ? ` (${amount})` : ""}`,
      actor: plan ? `${PLAN_LABEL[plan.planId] ?? plan.planId}, ${plan.period}` : (row.email ?? "Whop"),
      timestamp: row.created_at,
    };
  });

  return [...logged, ...signups, ...billing];
}

/** The sources plus the latest failed or stuck jobs, newest first. */
function mergeActivity(sources: ActivityLogEntry[], jobs: SystemJob[], limit = 7): ActivityLogEntry[] {
  const broken = jobs
    .filter((j) => j.status === "failed" || j.status === "stuck")
    .slice(0, FEED_PER_SOURCE)
    .map(
      (j): ActivityLogEntry => ({
        id: `job-${j.id}`,
        type: "system",
        message: `${JOB_TYPE_LABEL[j.type]} ${j.status === "stuck" ? "stuck" : "failed"}`,
        actor: j.userEmail,
        timestamp: j.startedAt,
      })
    );
  return [...sources, ...broken]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
