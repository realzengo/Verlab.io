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

export interface ApiKey {
  id: string;
  label: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt?: string;
  scopes: string[];
  revoked?: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export type ToolTone = "blue" | "violet" | "amber" | "green" | "rose" | "sky";

export interface ToolTileData {
  label: string;
  href: string;
  icon: LucideIcon;
  tone?: ToolTone;
}

export interface FeatureGridItem {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
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

export interface NicheClaim {
  id: string;
  nicheName: string;
  angle: NicheBendAngle;
  exampleTitles: string[];
  channelName: string | null;
  avatarUrl: string | null;
  platform: NicheBendPlatform;
  createdAt: string;
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

export type TransactionStatus = "paid" | "failed" | "refunded";

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  plan: "core" | "pro" | "scale";
  amount: number;
  status: TransactionStatus;
  method: "card" | "paypal";
  date: string;
}

export interface RevenuePoint {
  date: string;
  mrr: number;
  newMrr: number;
  churnedMrr: number;
}

export interface SignupPoint {
  date: string;
  signups: number;
  trials: number;
}

export type AdminToolKey = "bend" | "niches" | "transcripts" | "downloader" | "mcp";

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
export type SystemJobType = "niche-bend" | "sop-generation" | "transcript" | "download";

export interface SystemJob {
  id: string;
  type: SystemJobType;
  status: SystemJobStatus;
  userEmail: string;
  startedAt: string;
  durationMs?: number;
}

export interface ApiEndpointHealth {
  endpoint: string;
  method: "GET" | "POST";
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
