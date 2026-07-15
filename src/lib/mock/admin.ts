import type {
  AdminTeamMember,
  AdminUser,
  ApiEndpointHealth,
  ActivityLogEntry,
  FeatureFlag,
  PlanDistribution,
  RevenuePoint,
  SignupPoint,
  SystemJob,
  ToolUsageShare,
  Transaction,
  UsagePoint,
} from "@/lib/types";

const TODAY = new Date("2026-07-15T09:00:00Z");
export const NOW_ISO = TODAY.toISOString();

function isoDaysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function dateOnlyDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10);
}

// Deterministic pseudo-noise so charts look organic without Math.random
// (keeps server/client render identical — no hydration mismatch).
function wave(i: number, amplitude: number, period: number, phase = 0): number {
  return Math.sin((i / period) * Math.PI * 2 + phase) * amplitude;
}

// --- Revenue (last 30 days) -------------------------------------------------

export const REVENUE_SERIES: RevenuePoint[] = Array.from({ length: 30 }, (_, i) => {
  const day = 29 - i;
  const base = 18400 + i * 168 + wave(i, 260, 9);
  const newMrr = Math.round(420 + wave(i, 140, 6, 1) + i * 3);
  const churnedMrr = Math.round(160 + wave(i, 70, 11, 2));
  return {
    date: dateOnlyDaysAgo(day),
    mrr: Math.round(base),
    newMrr: Math.max(60, newMrr),
    churnedMrr: Math.max(20, churnedMrr),
  };
});

export const CURRENT_MRR = REVENUE_SERIES[REVENUE_SERIES.length - 1].mrr;
export const PREVIOUS_MRR = REVENUE_SERIES[REVENUE_SERIES.length - 8].mrr;
export const MRR_GROWTH_PCT = Number((((CURRENT_MRR - PREVIOUS_MRR) / PREVIOUS_MRR) * 100).toFixed(1));

// Company-wide totals (the ADMIN_USERS list below is a recent-signups sample,
// not the full base — same pattern as any paginated admin users table).
export const TOTAL_USERS_COUNT = 1284;
export const ACTIVE_TRIALS_COUNT = 92;
export const PAYING_USERS_COUNT = 736;
export const CHURN_RATE_PCT = 3.2;
export const PREVIOUS_CHURN_RATE_PCT = 3.6;

// --- Signups (last 30 days) -------------------------------------------------

export const SIGNUP_SERIES: SignupPoint[] = Array.from({ length: 30 }, (_, i) => {
  const day = 29 - i;
  const signups = Math.max(3, Math.round(14 + wave(i, 6, 7) + (i > 22 ? 5 : 0)));
  const trials = Math.max(1, Math.round(signups * 0.62 + wave(i, 2, 5, 1)));
  return { date: dateOnlyDaysAgo(day), signups, trials };
});

// --- Tool usage (last 30 days, 5 tools) -------------------------------------

export const USAGE_SERIES: UsagePoint[] = Array.from({ length: 30 }, (_, i) => {
  const day = 29 - i;
  return {
    date: dateOnlyDaysAgo(day),
    bend: Math.max(8, Math.round(62 + wave(i, 18, 8) + i * 1.1)),
    niches: Math.max(5, Math.round(48 + wave(i, 14, 6, 1))),
    transcripts: Math.max(10, Math.round(95 + wave(i, 22, 9, 2) + i * 0.6)),
    downloader: Math.max(6, Math.round(70 + wave(i, 16, 7, 0.5))),
    mcp: Math.max(2, Math.round(20 + wave(i, 9, 10, 1.5) + i * 0.4)),
  };
});

export const TOOL_USAGE_SHARE: ToolUsageShare[] = [
  { tool: "bend", label: "Niche Bending", count: USAGE_SERIES.reduce((s, p) => s + p.bend, 0), tone: "violet" },
  { tool: "niches", label: "Niche Finder", count: USAGE_SERIES.reduce((s, p) => s + p.niches, 0), tone: "blue" },
  { tool: "transcripts", label: "Transcripts", count: USAGE_SERIES.reduce((s, p) => s + p.transcripts, 0), tone: "amber" },
  { tool: "downloader", label: "Downloader", count: USAGE_SERIES.reduce((s, p) => s + p.downloader, 0), tone: "green" },
  { tool: "mcp", label: "MCP", count: USAGE_SERIES.reduce((s, p) => s + p.mcp, 0), tone: "rose" },
];

// --- Users -------------------------------------------------------------------

const FIRST_NAMES = [
  "Ava", "Noah", "Mia", "Ethan", "Zoe", "Liam", "Ines", "Marcus", "Priya", "Kenji",
  "Layla", "Theo", "Sofia", "Owen", "Nadia", "Diego", "Ruth", "Amir", "Chloe", "Felix",
  "Hana", "Jonas", "Wren", "Tariq",
];
const LAST_NAMES = [
  "Bennett", "Kowalski", "Reyes", "Okafor", "Lindgren", "Park", "Fontaine", "Ibrahim",
  "Costa", "Nakamura", "Whitfield", "Petrov", "Salazar", "Moreau", "Hassan", "Larsson",
  "Chu", "Delgado", "Vance", "Osei", "Bianchi", "Novak", "Sørensen", "Marsh",
];
const COUNTRIES = ["US", "UK", "CA", "DE", "AU", "BR", "IN", "NL", "SE", "PH"];
const PLANS: AdminUser["plan"][] = ["core", "pro", "scale"];
const STATUSES: AdminUser["status"][] = ["active", "active", "active", "trialing", "past_due", "canceled", "suspended"];
export const PLAN_MRR: Record<AdminUser["plan"], number> = { core: 19, pro: 49, scale: 129 };

export const ADMIN_USERS: AdminUser[] = FIRST_NAMES.map((first, i) => {
  const last = LAST_NAMES[i];
  const plan = PLANS[Math.floor(wave(i, 1.5, 5) + 1.5) % 3];
  const status = STATUSES[i % STATUSES.length];
  const signupDay = 4 + i * 14 + Math.round(wave(i, 5, 4));
  const lastActiveDay = Math.max(0, Math.round(wave(i, 4, 3, 1)) + (status === "active" ? 0 : 6));
  return {
    id: `usr_${(i + 1).toString().padStart(3, "0")}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${["gmail.com", "outlook.com", "proton.me", "icloud.com"][i % 4]}`,
    plan,
    status,
    mrr: status === "canceled" || status === "suspended" ? 0 : PLAN_MRR[plan],
    signupDate: dateOnlyDaysAgo(Math.min(signupDay, 340)),
    lastActiveAt: isoDaysAgo(lastActiveDay),
    country: COUNTRIES[i % COUNTRIES.length],
    usage: {
      bends: Math.max(0, Math.round(6 + wave(i, 5, 6))),
      transcripts: Math.max(0, Math.round(14 + wave(i, 9, 5, 1))),
      downloads: Math.max(0, Math.round(10 + wave(i, 7, 4, 2))),
      apiCalls: Math.max(0, Math.round(40 + wave(i, 30, 7, 0.5) * (plan === "scale" ? 3 : 1))),
    },
  };
});

export const PLAN_DISTRIBUTION: PlanDistribution[] = [
  { plan: "core", label: "Core", count: 318, tone: "sky" },
  { plan: "pro", label: "Pro", count: 312, tone: "blue" },
  { plan: "scale", label: "Scale", count: 106, tone: "violet" },
];

// --- Transactions --------------------------------------------------------------

export const TRANSACTIONS: Transaction[] = ADMIN_USERS.slice(0, 16).map((user, i) => {
  const status: Transaction["status"] = i === 3 || i === 11 ? "failed" : i === 7 ? "refunded" : "paid";
  return {
    id: `txn_${(i + 1).toString().padStart(4, "0")}`,
    userId: user.id,
    userName: user.name,
    plan: user.plan,
    amount: PLAN_MRR[user.plan],
    status,
    method: i % 5 === 0 ? "paypal" : "card",
    date: isoDaysAgo(i + Math.round(wave(i, 2, 4))),
  };
});

// --- Activity log ----------------------------------------------------------

export const ACTIVITY_LOG: ActivityLogEntry[] = [
  { id: "act_1", type: "billing", message: "Payment succeeded — Pro plan renewal", actor: "Priya Fontaine", timestamp: isoDaysAgo(0) },
  { id: "act_2", type: "user", message: "New signup from organic search", actor: "Wren Sørensen", timestamp: isoDaysAgo(0) },
  { id: "act_3", type: "system", message: "Niche Bend job failed — Anthropic API timeout", actor: "system", timestamp: isoDaysAgo(0) },
  { id: "act_4", type: "billing", message: "Payment failed — card declined", actor: "Owen Ibrahim", timestamp: isoDaysAgo(1) },
  { id: "act_5", type: "content", message: "New SOP generated: Corporate Fraud Timeline", actor: "Marcus Reyes", timestamp: isoDaysAgo(1) },
  { id: "act_6", type: "user", message: "Upgraded Core → Pro", actor: "Zoe Okafor", timestamp: isoDaysAgo(1) },
  { id: "act_7", type: "system", message: "MCP server deployed v1.4.2", actor: "system", timestamp: isoDaysAgo(2) },
  { id: "act_8", type: "user", message: "Account suspended — ToS violation", actor: "admin: Zengo", timestamp: isoDaysAgo(2) },
  { id: "act_9", type: "billing", message: "Refund issued — duplicate charge", actor: "admin: Zengo", timestamp: isoDaysAgo(3) },
  { id: "act_10", type: "content", message: "3,200 transcripts extracted (daily total)", actor: "system", timestamp: isoDaysAgo(3) },
  { id: "act_11", type: "user", message: "Canceled subscription — Scale plan", actor: "Diego Whitfield", timestamp: isoDaysAgo(4) },
  { id: "act_12", type: "system", message: "API rate limit tuning deployed", actor: "system", timestamp: isoDaysAgo(5) },
];

// --- System jobs --------------------------------------------------------------

const JOB_TYPES: SystemJob["type"][] = ["niche-bend", "sop-generation", "transcript", "download"];
const JOB_STATUSES: SystemJob["status"][] = ["success", "success", "success", "running", "queued", "failed"];

export const SYSTEM_JOBS: SystemJob[] = Array.from({ length: 14 }, (_, i) => {
  const status = JOB_STATUSES[i % JOB_STATUSES.length];
  return {
    id: `job_${(i + 1).toString().padStart(4, "0")}`,
    type: JOB_TYPES[i % JOB_TYPES.length],
    status,
    userEmail: ADMIN_USERS[i % ADMIN_USERS.length].email,
    startedAt: isoDaysAgo(0).slice(0, 10) + "T" + String(23 - i).padStart(2, "0") + ":12:00.000Z",
    durationMs: status === "success" || status === "failed" ? 1800 + Math.round(wave(i, 900, 5) + 2200) : undefined,
  };
});

export const JOB_SUCCESS_RATE_PCT = Number(
  ((SYSTEM_JOBS.filter((j) => j.status === "success").length / SYSTEM_JOBS.filter((j) => j.status !== "queued" && j.status !== "running").length) * 100).toFixed(1)
);

// --- API health -----------------------------------------------------------

export const UPTIME_PCT_30D = 99.96;

export const API_HEALTH: ApiEndpointHealth[] = [
  { endpoint: "/api/bend", method: "POST", callsToday: 842, p50Ms: 620, p95Ms: 2400, errorRatePct: 0.9 },
  { endpoint: "/api/niche-bend/analyze", method: "POST", callsToday: 611, p50Ms: 980, p95Ms: 3100, errorRatePct: 1.4 },
  { endpoint: "/api/niche-bend/sop", method: "POST", callsToday: 388, p50Ms: 1240, p95Ms: 4200, errorRatePct: 2.1 },
  { endpoint: "/api/niche-bend/status/:jobId", method: "GET", callsToday: 5320, p50Ms: 60, p95Ms: 180, errorRatePct: 0.1 },
  { endpoint: "/mcp/v1/sse", method: "GET", callsToday: 1204, p50Ms: 90, p95Ms: 310, errorRatePct: 0.3 },
];

// --- Feature flags -----------------------------------------------------------

export const FEATURE_FLAGS: FeatureFlag[] = [
  { id: "flag_niche_bend_v2", label: "Niche Bending v2 pipeline", description: "Route bend jobs through the new multi-step analysis pipeline.", enabled: true, rolloutPct: 100 },
  { id: "flag_mcp_public", label: "Public MCP server", description: "Allow unauthenticated MCP discovery for Claude/ChatGPT connectors.", enabled: true, rolloutPct: 100 },
  { id: "flag_downloader_mp3", label: "MP3 audio downloads", description: "Enable audio-only extraction in the media downloader.", enabled: true, rolloutPct: 100 },
  { id: "flag_scale_seats", label: "Scale plan team seats", description: "Multi-seat billing for the Scale tier.", enabled: false, rolloutPct: 0 },
  { id: "flag_ai_hook_rewrite", label: "AI hook rewriter", description: "One-click hook rewrite suggestions inside Script Maker.", enabled: true, rolloutPct: 35 },
  { id: "flag_export_xml", label: "XML export", description: "Export scripts/SOPs as XML for editing pipelines.", enabled: false, rolloutPct: 10 },
];

// --- Admin team -----------------------------------------------------------

export const ADMIN_TEAM: AdminTeamMember[] = [
  { id: "adm_1", name: "Zengo", email: "zengo@clypa.io", role: "owner", lastLogin: isoDaysAgo(0) },
  { id: "adm_2", name: "Ruth Petrov", email: "ruth@clypa.io", role: "admin", lastLogin: isoDaysAgo(1) },
  { id: "adm_3", name: "Amir Costa", email: "amir@clypa.io", role: "support", lastLogin: isoDaysAgo(2) },
  { id: "adm_4", name: "Hana Larsson", email: "hana@clypa.io", role: "support", lastLogin: isoDaysAgo(6) },
];
