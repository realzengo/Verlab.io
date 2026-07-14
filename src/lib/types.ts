import type { LucideIcon } from "lucide-react";

export type StreakDayStatus = "hit" | "missed" | "today" | "future";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: "free" | "monthly" | "annual";
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

export type LibraryItemType = "transcript" | "sop" | "script" | "download";

export interface LibraryItem {
  id: string;
  type: LibraryItemType;
  title: string;
  folder?: string;
  createdAt: string;
  refId: string;
}

export interface Collection {
  id: string;
  name: string;
  sourceUrl: string;
  itemCount: number;
  status: "queued" | "processing" | "complete" | "failed";
  progress: number;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  category: "hooks" | "rewrite" | "virality";
  description: string;
  icon: LucideIcon;
}

export interface PricingPlan {
  id: "free" | "monthly" | "annual";
  name: string;
  price: number;
  billingPeriod: "forever" | "mo" | "yr";
  priceNote?: string;
  recommended?: boolean;
  cta: string;
  features: string[];
  limits?: string;
}

export interface ComparisonRow {
  feature: string;
  free: boolean | string;
  monthly: boolean | string;
  annual: boolean | string;
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
