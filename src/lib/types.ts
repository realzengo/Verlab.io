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

export interface Niche {
  id: string;
  name: string;
  category: string;
  momentumScore: number;
  momentumTrend: "up" | "down" | "flat";
  description: string;
  faceless: boolean;
  tags: string[];
  sampleVideos: SampleVideo[];
}

/** Mirrors NicheBendSOP in src/app/api/bend/route.ts field-for-field. */
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

/** Mirrors NicheBendResult in src/app/api/bend/route.ts field-for-field. */
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

export type DownloadPlatform = "tiktok" | "youtube" | "instagram";
export type DownloadFormat = "mp4" | "mp3";

export interface DownloadItem {
  id: string;
  title: string;
  sourceUrl: string;
  platform: DownloadPlatform;
  format: DownloadFormat;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  category: "hooks" | "rewrite" | "virality";
  description: string;
  icon: LucideIcon;
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

export interface ToolTileData {
  label: string;
  href: string;
  icon: LucideIcon;
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
  analysis?: NicheBendChannelAnalysis;
  candidates?: NicheBendCandidate[];
  sop?: NicheBendSopResult;
  error?: { message: string };
}
