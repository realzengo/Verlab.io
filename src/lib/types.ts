import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { LucideIcon } from "lucide-react";

export type StreakDayStatus = "hit" | "missed" | "today" | "future";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: "core" | "pro" | "scale";
  streak: {
    current: number;
    goal: number;
    daysToGo: number;
    days: { label: string; status: StreakDayStatus }[];
  };
}

export interface SampleVideo {
  id: string;
  thumbnailUrl: string;
  title: string;
  views: string;
}

// The Gemini transcript-analysis worker's structured verdict (see
// niche-video-enrichment.ts). Every enrichment attempt writes one of these
// three terminal shapes onto trending_videos.transcript_analysis -- "status"
// is what lets a UI (or a future retry pass) tell a real verdict apart from
// a permanent miss without re-parsing the whole payload.
/** Sub-genre/format tag from the video classification passes -- "other" (or
 * an empty array) means none of the fixed tags clearly applied. Declared as a
 * const array so both classifiers (the per-video transcript pass in
 * niche-video-enrichment.ts and the batched metadata pass in
 * faceless-batch-classifier.ts) can build a Zod enum from the same source. */
export const FORMAT_TAGS = ["top5_ranking", "roblox_gaming", "commentary", "animation_2d", "other"] as const;

export type FormatTag = (typeof FORMAT_TAGS)[number];

/** trending_videos.faceless_rank -- the feed's primary sort key. "unknown"
 * deliberately sits between the two known states so unclassified videos
 * outrank ones we know show a face, and nothing is ever hidden (see
 * 20260910120000_trending_videos_faceless_rank.sql). */
export const FACELESS_RANK = {
  faceless: 0,
  unknown: 1,
  notFaceless: 2,
} as const;

export type FacelessRank = (typeof FACELESS_RANK)[keyof typeof FACELESS_RANK];

export interface AnalyzedTranscript {
  status: "analyzed";
  /** One of the fixed niches in niches-catalog.ts's NICHE_ORDER. */
  niche: string;
  is_faceless: boolean;
  confidence: number;
  /** 0-2 tags; see analyzeVideoTranscript's prompt in niche-video-enrichment.ts. */
  format_tags: FormatTag[];
  summary: string;
  reasoning: string;
  analyzed_at: string;
  model: string;
}

export interface UnavailableTranscript {
  status: "unavailable";
  reason: string;
  failed_at: string;
}

export interface FailedTranscript {
  status: "failed";
  error: string;
  failed_at: string;
}

export type TranscriptAnalysis = AnalyzedTranscript | UnavailableTranscript | FailedTranscript;

export interface TrendingVideo {
  id: string;
  title: string;
  views: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  followerCount: number;
  coverUrl: string;
  videoUrl: string;
  author: string;
  avatarUrl: string;
  hashtag: string;
  niche: string;
  postedAt: string | null;
  platform: "tiktok" | "youtube";
  /** Null until the enrichment worker has attempted this video at least once. */
  transcriptAnalysis: TranscriptAnalysis | null;
}

export interface Niche {
  id: string;
  name: string;
  category: string;
  momentumScore: number;
  momentumTrend: "up" | "down" | "flat";
  description: string;
  faceless: boolean;
  tags: string[];
  platform: "tiktok" | "youtube" | "instagram" | "mixed";
  sampleVideos: SampleVideo[];
}

export interface NicheBendSOP {
  hookFormula: string;
  structure: string[];
  pacing: string;
  dos: string[];
  donts: string[];
}

export interface Sop extends NicheBendSOP {
  id: string;
  title: string;
  sourceNicheId?: string;
  targetNicheId?: string;
  createdAt: string;
  savedByUser?: boolean;
}

export interface NicheBendResult {
  analysis: string;
  sop: NicheBendSOP;
  scriptIdeas: string[];
  scripts: string[];
}

export interface BendResult extends NicheBendResult {
  id: string;
  sourceNiche: string;
  targetNiche: string;
  createdAt: string;
}

export interface Script {
  id: string;
  title: string;
  topic: string;
  sopId?: string;
  hook: string;
  body: string;
  cta: string;
  createdAt: string;
}

export interface TranscriptLine {
  timestamp: string;
  speaker?: string;
  text: string;
}

export interface Transcript {
  id: string;
  sourceUrl: string;
  platform: "tiktok" | "reels" | "shorts";
  title: string;
  coverUrl: string;
  durationSeconds: number;
  lines: TranscriptLine[];
  createdAt: string;
}

export type TranscriptRowStatus = "queued" | "processing" | "complete" | "failed";

export interface TranscriptRow {
  id: string;
  source_url: string;
  platform: "tiktok" | "reels" | "shorts";
  status: TranscriptRowStatus;
  title: string | null;
  cover_url: string | null;
  duration_seconds: number | null;
  video_url: string | null;
  embed_url: string | null;
  lines: TranscriptLine[] | null;
  error_message: string | null;
  created_at: string;
}

// The source formats AI clipping fetches from video-download-api.com: an mp3
// for transcription and a 720p/1080p stream for cutting. Server-side only --
// Verlab has no user-facing video downloader.
export type ClipSourceFormat = "mp3" | "720" | "1080";

export type PricingFrequency = "monthly" | "yearly";

export interface PricingPlan {
  id: "core" | "pro" | "scale";
  name: string;
  info: string;
  price: Record<PricingFrequency, number>;
  recommended?: boolean;
  monthlyOnly?: boolean;
  cta: string;
  features: { text: string; tooltip?: string }[];
  limits?: string;
  /** Credits the plan adds per month. A yearly plan adds 12x this up front. */
  creditsPerPeriod?: number;
}

export interface ComparisonRow {
  feature: string;
  core: boolean | string;
  pro: boolean | string;
  scale: boolean | string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  /** Optional follow-up link shown under the answer, e.g. the Refund Policy. */
  link?: { label: string; href: string };
}

/** Tile colour of an entry in the sidebar's hover menu (gradients live in Sidebar). */
export type NavMenuTone = "red" | "orange" | "green" | "purple" | "blue" | "pink";

export interface NavMenuItem {
  title: string;
  /** One short line under the title. */
  description: string;
  href: string;
  /** Drawn white, filled, on the tone's gradient tile. */
  icon: PhosphorIcon;
  tone: NavMenuTone;
  badge?: string;
}

export interface NavMenuSection {
  title: string;
  items: NavMenuItem[];
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hover menu beside this row in the app sidebar: columns of sections. */
  menu?: NavMenuSection[][];
  /** Small grey pill beside the label in the app sidebar. */
  badge?: string;
  /** App sidebar section heading this row sits under; none = the top group. */
  section?: string;
}

export type ToolTone = "blue" | "violet" | "amber" | "green" | "rose" | "sky" | "orange";

export interface ToolTileData {
  label: string;
  href: string;
  icon: LucideIcon;
  tone?: ToolTone;
}

export type NicheBendPlatform = "youtube" | "tiktok";

export type NicheBendVideoType = "shorts" | "long-form";

export interface NicheBendVideo {
  title: string;
  views: string;
}

export interface NicheBendChannelAnalysis {
  channelName: string;
  platform: NicheBendPlatform;
  avatarUrl?: string;
  detectedNiche: string;
  format: string;
  topVideos: NicheBendVideo[];
}

export type NicheBendAngle = "Ranking" | "Timeline" | "Conflict";

export interface NicheBendCandidate {
  id: 1 | 2 | 3;
  nicheName: string;
  angle: NicheBendAngle;
  exampleTitles: string[];
}

export type NicheBendJobStatus =
  | "opening_channel"
  | "reading_videos"
  | "identifying_format"
  | "generating_bends"
  | "ready"
  | "generating_sop"
  | "sop_ready"
  | "failed";

export interface NicheBendHookFormula {
  template: string;
  usedInVideos: string[];
  psychology: string;
  whenToUse: string;
  forYourChannelExamples: string[];
}

export interface NicheBendScriptBeat {
  beat: string;
  timing: string;
  function: string;
}

export interface NicheBendStorytellingFramework {
  name: string;
  howItWorks: string;
  usedInVideos: string[];
  steps: string[];
  signaturePhrases: string[];
  yourChannelMoat: string;
}

export interface NicheBendRehook {
  phrase: string;
  whenToUse: string;
}

export interface NicheBendRetentionMechanics {
  rehookCatalog: NicheBendRehook[];
  patternInterrupts: string[];
  openLoopsRule: string;
  specificitySpikesRule: string;
  specificityExamples: string[];
}

export interface NicheBendOpeningClosingPatterns {
  first30SecondsTemplate: string[];
  hardRules: string[];
  howVideosEnd: string;
  signatureClosingPhrases: string[];
}

export interface NicheBendQuickReferenceCard {
  hookFormulaPicks: string[];
  beatStructureOneLine: string;
  topRehooks: string[];
  dos: string[];
  donts: string[];
}

export interface NicheBendChannelOverview {
  channel: string;
  niche: string;
  format: string;
  narrationPov: string;
  avgLength: string;
  recurringThemes: string[];
  yourChannelNote: string;
}

export interface NicheBendSopContent {
  title: string;
  subtitle: string;
  onelinePromise: string;
  channelOverview: NicheBendChannelOverview;
  hookPlaybook: NicheBendHookFormula[];
  scriptStructureBeats: NicheBendScriptBeat[];
  storytellingFrameworks: NicheBendStorytellingFramework[];
  retentionMechanics: NicheBendRetentionMechanics;
  openingClosingPatterns: NicheBendOpeningClosingPatterns;
  quickReferenceCard: NicheBendQuickReferenceCard;
}

export interface NicheBendSopResult {
  id: string;
  jobId: string;
  chosenBend: NicheBendCandidate;
  originalChannel: NicheBendChannelAnalysis;
  content: NicheBendSopContent;
  downloads: {
    docxUrl: string;
    pdfUrl: string;
  };
  createdAt: string;
}

export interface NicheBendJobStatusResponse {
  jobId: string;
  status: NicheBendJobStatus;
  statusText: string;
  progress: number;
  saved: boolean;
  analysis?: NicheBendChannelAnalysis;
  candidates?: NicheBendCandidate[];
  sop?: NicheBendSopResult;
  error?: { message: string };
}

export interface NicheBendHistoryItem {
  jobId: string;
  sourceUrl: string;
  platform: NicheBendPlatform;
  videoType: NicheBendVideoType;
  status: NicheBendJobStatus;
  channelName: string | null;
  avatarUrl: string | null;
  detectedNiche: string | null;
  chosenBend: NicheBendCandidate | null;
  saved: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

export type AdminUserStatus = "active" | "trialing" | "past_due" | "canceled" | "suspended" | "free";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: "core" | "pro" | "scale" | "free";
  status: AdminUserStatus;
  mrr: number;
  signupDate: string;
  lastActiveAt: string;
  country: string;
  usage: {
    bends: number;
    transcripts: number;
    downloads: number;
    apiCalls: number;
  };
}

export type RevenueTransactionType = "order.paid" | "order.refunded";

export interface RevenueTransaction {
  id: string;
  type: RevenueTransactionType;
  userName: string;
  userEmail: string;
  itemLabel: string;
  billingReason: string | null;
  /** What the customer paid (negative for a refund). */
  amount: number;
  /** What reached the Whop balance after Whop's fees, when known. */
  net?: number;
  currency: string;
  createdAt: string;
}

/** What a failed Whop charge was for, from Whop's billing_reason. */
export type FailedPaymentKind = "renewal" | "new_signup" | "credit_pack" | "other";

/** Whether the customer was emailed about a failed payment (renewals only). */
export type FailedPaymentEmailStatus = "sent" | "failed" | "sending" | "not_sent";

/** One failed Whop charge, latest attempt, for the admin revenue page. */
export interface FailedPayment {
  paymentId: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  kind: FailedPaymentKind;
  planLabel: string | null;
  amount: number;
  /** Whop's customer-facing decline message, else its decline code. */
  reason: string | null;
  /** How many times Whop has tried this charge. */
  attempts: number;
  failedAt: string;
  /** A later successful payment landed on the same membership. */
  recovered: boolean;
  emailStatus: FailedPaymentEmailStatus;
}

/** The Whop account balance, as the Whop dashboard shows it. */
export interface WhopBalance {
  available: number;
  pending: number;
  total: number;
}

export interface PlanMrrBreakdown {
  plan: "core" | "pro" | "scale";
  label: string;
  subscriberCount: number;
  mrr: number;
  tone: ToolTone;
}

export interface RevenueDailyPoint {
  date: string;
  collected: number;
}

export interface CancellationReasonBreakdown {
  reason: string;
  label: string;
  count: number;
  tone: ToolTone;
}

export interface RevenueData {
  mrr: number;
  arr: number;
  arpu: number;
  activeSubscribers: number;
  trialingCount: number;
  pastDueCount: number;
  churnedLast30d: number;
  newSubscribersLast30d: number;
  churnRatePct: number;
  netCollectedLast30d: number;
  /** null when Whop couldn't be asked; the money figures then come from webhook rows. */
  whopBalance: WhopBalance | null;
  /** Where the collected figures, chart and transactions came from. */
  moneySource: "whop" | "webhooks";
  planBreakdown: PlanMrrBreakdown[];
  dailySeries: RevenueDailyPoint[];
  recentTransactions: RevenueTransaction[];
  /** Failed charges in the last 90 days, newest first, one row per payment. */
  failedPayments: FailedPayment[];
  webhookConfigured: boolean;
  /** Whether Whop is delivering to our endpoint right now; null if Whop couldn't be asked. */
  webhookEnabled: boolean | null;
  cancellationBreakdown: CancellationReasonBreakdown[];
  retentionOffersShown: number;
  retentionOfferAcceptRatePct: number;
}

export interface SignupPoint {
  date: string;
  signups: number;
  trials: number;
}

export type AdminToolKey = "bend" | "niches" | "transcripts" | "downloader" | "mcp" | "image" | "video" | "voiceover";

export type UsagePoint = { date: string } & Record<AdminToolKey, number>;

export interface ToolUsageShare {
  tool: AdminToolKey;
  label: string;
  count: number;
  tone: ToolTone;
}

export type ActivityType = "billing" | "user" | "system" | "content";

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  message: string;
  actor: string;
  timestamp: string;
}

/** `stuck` = still queued/running an hour after it started (see getSystemJobs). */
export type SystemJobStatus = "queued" | "running" | "success" | "failed" | "stuck";
export type SystemJobType =
  | "niche-bend"
  | "sop-generation"
  | "transcript"
  | "download"
  | "clipping"
  | "clip-render"
  | "creator-analysis"
  | "niche-report"
  | "video-generation"
  | "image-generation"
  | "voiceover-generation";

export interface SystemJob {
  id: string;
  type: SystemJobType;
  status: SystemJobStatus;
  userEmail: string;
  startedAt: string;
  durationMs?: number;
  /** Raw provider/error detail for failed jobs -- admin-only, never shown to the end user who saw a generic message instead. */
  errorMessage?: string | null;
  /** What the user fed the tool (video link, prompt, title), to retry or report it. */
  source?: string | null;
}

export interface ApiEndpointHealth {
  endpoint: string;
  // MCP tool calls are logged with method "TOOL_CALL" (see
  // src/lib/server/mcp/server.ts), so this isn't limited to HTTP verbs.
  method: string;
  callsToday: number;
  p50Ms: number;
  p95Ms: number;
  errorRatePct: number;
}

export interface FeatureFlag {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  rolloutPct: number;
}

export type PromoRewardType = "credits" | "discount_percent";

export interface PromoCode {
  id: string;
  code: string;
  rewardType: PromoRewardType;
  rewardValue: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiProvider {
  id: string;
  name: string;
  category: string;
  envVar: string | null;
  websiteUrl: string | null;
  notes: string | null;
  monthlyCost: number;
  currency: string;
  isActive: boolean;
  configured: boolean;
  updatedAt: string;
}

export type AdminRole = "owner" | "admin" | "support";

export interface AdminTeamMember {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  lastLogin: string;
}

export interface PlanDistribution {
  plan: "free" | "core" | "pro" | "scale";
  label: string;
  count: number;
  tone: ToolTone;
}

export interface CreditSpendPoint {
  date: string;
  spent: number;
  granted: number;
}

export interface CreditActionShare {
  actionKey: string;
  label: string;
  amount: number;
  tone: ToolTone;
}

export interface CreditTopSpender {
  id: string;
  name: string;
  email: string;
  plan: "core" | "pro" | "scale" | "free";
  spent30d: number;
  balance: number;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  feature: string;
  actionKey: string | null;
  grantedBy: string | null;
  createdAt: string;
}

export interface CreditsOverview {
  totalOutstanding: number;
  spentToday: number;
  spentLast7Days: number;
  spentLast30Days: number;
  dailySeries: CreditSpendPoint[];
  spendByAction: CreditActionShare[];
  topSpenders: CreditTopSpender[];
  recentTransactions: CreditLedgerEntry[];
}

export interface CreditsAdminUser {
  id: string;
  name: string;
  email: string;
  plan: "core" | "pro" | "scale" | "free";
  credits: number;
}

export type LibraryAssetType = "image" | "video" | "sop" | "voiceover";

export interface LibraryAsset {
  id: string;
  type: LibraryAssetType;
  title: string;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  sizeBytes: number | null;
  category: string;
  createdAt: string;
}


/** One line in the admin sidebar's status card. */
export type PulseTone = "good" | "warning" | "critical" | "neutral";

export interface PulseItem {
  id: string;
  tone: PulseTone;
  /** Week-over-week direction, for growth updates; problems have none. */
  trend?: "up" | "down" | "flat";
  /** A card glyph instead of the alert/trend one, for payment lines. */
  icon?: "card";
  title: string;
  detail?: string;
  /** The admin page that explains it. */
  href: string;
}

/** The admin sidebar's status card: problems first, then how growth is going. */
export interface AdminPulse {
  status: "good" | "warning" | "critical";
  headline: string;
  issueCount: number;
  items: PulseItem[];
  checkedAt: string;
}
