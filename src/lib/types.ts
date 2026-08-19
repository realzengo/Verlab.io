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
export interface AnalyzedTranscript {
  status: "analyzed";
  /** One of the fixed niches in niches-catalog.ts's NICHE_ORDER. */
  niche: string;
  is_faceless: boolean;
  confidence: number;
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

export type DownloadPlatform = "tiktok" | "youtube" | "facebook";

// Matches the format codes video-download-api.com accepts (a curated subset
// of their full list — see https://video-download-api.com/api/docs).
export type DownloadFormat = "mp3" | "m4a" | "aac" | "flac" | "wav" | "360" | "720" | "1080" | "1440" | "mp44k" | "mp48k";

export interface DownloadFormatOption {
  value: DownloadFormat;
  label: string;
  kind: "audio" | "video";
  extension: string;
  contentType: string;
}

export const DOWNLOAD_FORMAT_OPTIONS: DownloadFormatOption[] = [
  { value: "mp3", label: "MP3", kind: "audio", extension: "mp3", contentType: "audio/mpeg" },
  { value: "m4a", label: "M4A", kind: "audio", extension: "m4a", contentType: "audio/mp4" },
  { value: "360", label: "MP4 360p", kind: "video", extension: "mp4", contentType: "video/mp4" },
  { value: "720", label: "MP4 720p", kind: "video", extension: "mp4", contentType: "video/mp4" },
  { value: "1080", label: "MP4 1080p", kind: "video", extension: "mp4", contentType: "video/mp4" },
  { value: "1440", label: "MP4 1440p", kind: "video", extension: "mp4", contentType: "video/mp4" },
  { value: "aac", label: "AAC", kind: "audio", extension: "aac", contentType: "audio/aac" },
  { value: "flac", label: "FLAC", kind: "audio", extension: "flac", contentType: "audio/flac" },
  { value: "wav", label: "WAV", kind: "audio", extension: "wav", contentType: "audio/wav" },
  { value: "mp44k", label: "MP4 4K", kind: "video", extension: "mp4", contentType: "video/mp4" },
  { value: "mp48k", label: "MP4 8K", kind: "video", extension: "mp4", contentType: "video/mp4" },
];

export function getDownloadFormatOption(format: string): DownloadFormatOption | undefined {
  return DOWNLOAD_FORMAT_OPTIONS.find((option) => option.value === format);
}

export interface DownloadItem {
  id: string;
  title: string;
  sourceUrl: string;
  platform: DownloadPlatform;
  format: DownloadFormat;
  createdAt: string;
}

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
}

export interface NavSubItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  subItems?: NavSubItem[];
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

export type AdminUserStatus = "active" | "trialing" | "past_due" | "canceled" | "suspended";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: "core" | "pro" | "scale";
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
  amount: number;
  currency: string;
  createdAt: string;
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
  planBreakdown: PlanMrrBreakdown[];
  dailySeries: RevenueDailyPoint[];
  recentTransactions: RevenueTransaction[];
  webhookConfigured: boolean;
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

export type SystemJobStatus = "queued" | "running" | "success" | "failed";
export type SystemJobType =
  | "niche-bend"
  | "sop-generation"
  | "transcript"
  | "download"
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
  plan: "core" | "pro" | "scale";
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
  plan: "core" | "pro" | "scale";
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
  plan: "core" | "pro" | "scale";
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

// ---------------------------------------------------------------------------
// Faceless channel classifier
// ---------------------------------------------------------------------------

export type FacelessCategory =
  | "2D Animation"
  | "3D Animation"
  | "Whiteboard"
  | "Stock Footage"
  | "AI Pictures"
  | "Screen Recording"
  | "Documentary";

export type FacelessComplexity = "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";

export type FacelessSort = "trending" | "newest" | "views";

export interface FacelessChannelVideo {
  title: string;
  description?: string;
  /** Only populated for channels discovered via the SociaVault trending
   * pipeline (see faceless-tiktok-discovery.ts) -- Apify/ScrapeCreators
   * single-URL ingestion doesn't surface these. */
  viewsCount?: string;
  likesCount?: string;
  /** Raw counts, alongside the humanized display strings above -- lets
   * range filters (e.g. "views >= 100000") compare exact numbers instead of
   * re-parsing an already-rounded "1.7M" string. */
  viewCount?: number;
  likeCount?: number;
  coverUrl?: string;
  postedAt?: string | null;
  videoUrl?: string;
}

/** One video from TikTok's real, unfiltered trending feed (see
 * fetchTikTokTrendingFeed in sociavault-client.ts) -- not tied to a
 * niche_channels row, so `category` is a best-effort guess from the
 * caption's own hashtags ("Trending" when nothing in it matches our
 * catalog) rather than a verified classification. */
export interface TrendingFeedVideo {
  id: string;
  platform: NicheBendPlatform;
  category: string;
  thumbnailUrl: string;
  videoUrl: string;
  viewsCount: string;
  likesCount: string;
  viewCount: number;
  followerCount: number;
  postedAt: string | null;
}

export interface FacelessClassification {
  is_faceless: boolean;
  confidence_score: number;
  faceless_category: FacelessCategory;
  complexity: FacelessComplexity;
  viral_velocity_score: number;
  reasoning: string;
}

export interface NicheChannel {
  id: string;
  platform: NicheBendPlatform;
  channelUrl: string;
  channelTitle: string;
  channelDescription: string;
  avatarUrl: string | null;
  subscriberCount: number;
  totalViews: number;
  niche: string | null;
  visualTags: string[];
  recentVideos: FacelessChannelVideo[];
  isFaceless: boolean | null;
  facelessConfidence: number | null;
  facelessCategory: FacelessCategory | null;
  complexity: FacelessComplexity | null;
  viralVelocityScore: number | null;
  classificationReasoning: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/** Slimmer row shape for the admin "Niche Channels" table -- omits the
 * description/tags/videos the classifier reads but the list view doesn't show. */
export interface AdminNicheChannel {
  id: string;
  platform: NicheBendPlatform;
  channelUrl: string;
  channelTitle: string;
  avatarUrl: string | null;
  subscriberCount: number;
  totalViews: number;
  niche: string | null;
  isFaceless: boolean | null;
  facelessConfidence: number | null;
  facelessCategory: FacelessCategory | null;
  complexity: FacelessComplexity | null;
  viralVelocityScore: number | null;
  verifiedAt: string | null;
  createdAt: string;
}
