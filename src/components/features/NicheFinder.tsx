"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Download,
  Eye,
  Heart,
  Play,
  Search,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type NicheFinderPlatform = "tiktok" | "yt-shorts" | "yt-long";
type NicheFinderTimeframe = "7d" | "30d";
type NicheVelocity = "high" | "rising" | "cooling";

interface NicheScoreBreakdown {
  trend: number;
  engagement: number;
  viewsPerHr: number;
  competition: number;
  freshness: number;
}

interface NicheScore {
  rank: number;
  id: string;
  name: string;
  velocity: NicheVelocity;
  viewsPerHour: string;
  clypaScore: number;
  risingPercent: number;
  engagement: number;
  competition: string;
  breakdown: NicheScoreBreakdown;
}

interface TrendingVideo {
  id: string;
  platform: "TikTok" | "Reels" | "Shorts";
  subNiche: string;
  title: string;
  views: string;
  creatorInitials: string;
  gradient: string;
}

const PLATFORM_OPTIONS: { id: NicheFinderPlatform; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "yt-shorts", label: "YouTube Shorts" },
  { id: "yt-long", label: "Long Form" },
];

const TIMEFRAME_OPTIONS: { id: NicheFinderTimeframe; label: string }[] = [
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
];

const VELOCITY_LABEL: Record<NicheVelocity, string> = {
  high: "High velocity",
  rising: "Rising fast",
  cooling: "Cooling off",
};

const GROWTH_LABEL: Record<NicheVelocity, string> = {
  high: "Actively growing",
  rising: "Actively growing",
  cooling: "Cooling down",
};

const GROWTH_CLASSES: Record<NicheVelocity, string> = {
  high: "bg-success-tint text-success border border-success/20",
  rising: "bg-success-tint text-success border border-success/20",
  cooling: "bg-warning-tint text-warning border border-warning/20",
};

const NICHE_SCORES: NicheScore[] = [
  {
    rank: 1,
    id: "motivational",
    name: "Motivational",
    velocity: "high",
    viewsPerHour: "73.5M",
    clypaScore: 89,
    risingPercent: 95,
    engagement: 100,
    competition: "3/10",
    breakdown: { trend: 95.0, engagement: 100.0, viewsPerHr: 100.0, competition: 93.2, freshness: 44.2 },
  },
  {
    rank: 2,
    id: "medical-malpractice",
    name: "Medical Malpractice",
    velocity: "high",
    viewsPerHour: "41.2M",
    clypaScore: 82,
    risingPercent: 61,
    engagement: 88,
    competition: "5/10",
    breakdown: { trend: 84.0, engagement: 88.5, viewsPerHr: 91.0, competition: 78.4, freshness: 62.0 },
  },
  {
    rank: 3,
    id: "cult-breakdowns",
    name: "Cult Breakdowns",
    velocity: "high",
    viewsPerHour: "34.7M",
    clypaScore: 80,
    risingPercent: 73,
    engagement: 92,
    competition: "4/10",
    breakdown: { trend: 88.0, engagement: 92.0, viewsPerHr: 85.0, competition: 81.6, freshness: 70.3 },
  },
  {
    rank: 4,
    id: "corporate-espionage",
    name: "Corporate Espionage",
    velocity: "rising",
    viewsPerHour: "28.9M",
    clypaScore: 77,
    risingPercent: 44,
    engagement: 79,
    competition: "6/10",
    breakdown: { trend: 76.5, engagement: 79.0, viewsPerHr: 83.2, competition: 68.0, freshness: 55.5 },
  },
  {
    rank: 5,
    id: "military-disasters",
    name: "Military Disasters",
    velocity: "rising",
    viewsPerHour: "22.1M",
    clypaScore: 73,
    risingPercent: 38,
    engagement: 80,
    competition: "5/10",
    breakdown: { trend: 70.0, engagement: 80.0, viewsPerHr: 74.8, competition: 62.9, freshness: 51.0 },
  },
  {
    rank: 6,
    id: "financial-collapse",
    name: "Financial Collapse",
    velocity: "cooling",
    viewsPerHour: "19.4M",
    clypaScore: 68,
    risingPercent: 12,
    engagement: 71,
    competition: "7/10",
    breakdown: { trend: 58.0, engagement: 71.0, viewsPerHr: 66.5, competition: 54.2, freshness: 48.0 },
  },
];

const TRENDING_VIDEOS: TrendingVideo[] = [
  {
    id: "v1",
    platform: "TikTok",
    subNiche: "Medical",
    title: "The $2.3M mistake surgeons hope you never learn about",
    views: "4.2M",
    creatorInitials: "CC",
    gradient: "from-indigo-400 to-purple-500",
  },
  {
    id: "v2",
    platform: "Reels",
    subNiche: "Business",
    title: "The intern who leaked a decade of trade secrets",
    views: "5.6M",
    creatorInitials: "BB",
    gradient: "from-blue-400 to-cyan-500",
  },
  {
    id: "v3",
    platform: "TikTok",
    subNiche: "Finance",
    title: "The trade that erased a nation's pension fund",
    views: "3.3M",
    creatorInitials: "FG",
    gradient: "from-rose-400 to-orange-400",
  },
  {
    id: "v4",
    platform: "Shorts",
    subNiche: "History",
    title: "The battle plan that doomed 40,000 soldiers",
    views: "2.9M",
    creatorInitials: "MD",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    id: "v5",
    platform: "TikTok",
    subNiche: "True crime",
    title: "The recruiting tactic that hooked 4,000 members",
    views: "2.2M",
    creatorInitials: "CB",
    gradient: "from-fuchsia-400 to-pink-500",
  },
  {
    id: "v6",
    platform: "Reels",
    subNiche: "Mystery",
    title: "The last text message before she vanished",
    views: "1.9M",
    creatorInitials: "UD",
    gradient: "from-amber-400 to-red-400",
  },
  {
    id: "v7",
    platform: "Shorts",
    subNiche: "Science",
    title: "The decimal point error that collapsed a bridge",
    views: "1.2M",
    creatorInitials: "EF",
    gradient: "from-sky-400 to-indigo-500",
  },
  {
    id: "v8",
    platform: "TikTok",
    subNiche: "Business",
    title: "How a rival's mole sat in on every board meeting",
    views: "3.9M",
    creatorInitials: "BB",
    gradient: "from-lime-400 to-emerald-500",
  },
];

const PLATFORM_COLOR: Record<TrendingVideo["platform"], string> = {
  TikTok: "bg-red-600",
  Reels: "bg-fuchsia-600",
  Shorts: "bg-primary",
};

function PlatformToggle({
  value,
  onChange,
}: {
  value: NicheFinderPlatform;
  onChange: (value: NicheFinderPlatform) => void;
}) {
  return (
    <div role="tablist" aria-label="Platform" className="inline-flex items-center gap-1 rounded-full bg-app p-1">
      {PLATFORM_OPTIONS.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-[background-color,box-shadow] sm:px-4 sm:text-sm",
              isActive ? "bg-surface text-heading shadow-card" : "text-body hover:text-heading"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function TimeframeToggle({
  value,
  onChange,
}: {
  value: NicheFinderTimeframe;
  onChange: (value: NicheFinderTimeframe) => void;
}) {
  return (
    <div role="tablist" aria-label="Timeframe" className="inline-flex items-center gap-1 rounded-full bg-app p-1">
      {TIMEFRAME_OPTIONS.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-[background-color,box-shadow] sm:px-3.5 sm:text-sm",
              isActive ? "bg-surface text-heading shadow-card" : "text-body hover:text-heading"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ScoreBreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[72px] shrink-0 text-xs text-body">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-app">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-semibold text-heading">{value.toFixed(1)}</span>
    </div>
  );
}

function NicheScoreCard({ niche }: { niche: NicheScore }) {
  const [breakdownOpen, setBreakdownOpen] = useState(true);

  return (
    <div className="flex flex-col rounded-card-lg border border-hairline bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
              #{niche.rank}
            </span>
            <h3 className="text-lg font-bold leading-snug text-heading">{niche.name}</h3>
          </div>
          <p className="mt-1 text-xs text-body">
            {VELOCITY_LABEL[niche.velocity]} · {niche.viewsPerHour} views/hr
          </p>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
            GROWTH_CLASSES[niche.velocity]
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {GROWTH_LABEL[niche.velocity]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-accent-line bg-accent p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Clypa Score</p>
          <p className="mt-1 text-3xl font-extrabold text-heading">{niche.clypaScore}</p>
          <p className="mt-1 flex items-center justify-center gap-0.5 text-[11px] font-semibold text-success">
            <ArrowUp className="h-3 w-3" />
            Rising {niche.risingPercent}%
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <Eye className="h-3.5 w-3.5 text-body" />
          <p className="text-2xl font-bold text-heading">{niche.viewsPerHour}</p>
          <p className="text-[11px] text-body">Views/hr</p>
        </div>

        <div className="flex flex-col items-center justify-center gap-2.5 text-center">
          <div>
            <p className="text-sm font-semibold text-heading">{niche.engagement}%</p>
            <p className="text-[11px] text-body">Engagement</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-heading">{niche.competition}</p>
            <p className="text-[11px] text-body">Competition</p>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-hairline pt-3">
        <button
          type="button"
          onClick={() => setBreakdownOpen((prev) => !prev)}
          aria-expanded={breakdownOpen}
          className="flex w-full items-center justify-between"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-body">Score Breakdown</span>
          <ChevronDown className={cn("h-4 w-4 text-body transition-transform", breakdownOpen && "rotate-180")} />
        </button>
        {breakdownOpen && (
          <div className="mt-3 flex flex-col gap-2.5">
            <ScoreBreakdownRow label="Trend" value={niche.breakdown.trend} />
            <ScoreBreakdownRow label="Engagement" value={niche.breakdown.engagement} />
            <ScoreBreakdownRow label="Views/Hr" value={niche.breakdown.viewsPerHr} />
            <ScoreBreakdownRow label="Competition" value={niche.breakdown.competition} />
            <ScoreBreakdownRow label="Freshness" value={niche.breakdown.freshness} />
          </div>
        )}
      </div>

      <Link
        href="/app/bend"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] hover:-translate-y-px hover:bg-primary-hover sm:inline-flex sm:w-auto sm:self-start"
      >
        <Wand2 className="h-4 w-4" />
        Bend this niche
      </Link>
    </div>
  );
}

function TrendingVideoCard({ video }: { video: TrendingVideo }) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-card border border-hairline bg-ink">
      <div className={cn("absolute inset-0 bg-gradient-to-br", video.gradient)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/35" />

      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white",
            PLATFORM_COLOR[video.platform]
          )}
        >
          {video.platform}
        </span>
        <span className="rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
          {video.subNiche}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setSaved((prev) => !prev)}
        aria-label="Save video"
        aria-pressed={saved}
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
      >
        <Heart className={cn("h-3.5 w-3.5", saved && "fill-red-500 text-red-500")} />
      </button>

      <div className="absolute inset-0 flex items-center justify-center opacity-90 transition-opacity group-hover:opacity-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-card-hover">
          <Play className="h-4.5 w-4.5 fill-ink text-ink" />
        </div>
      </div>

      <div className="absolute bottom-2.5 left-2.5 right-11">
        <p className="line-clamp-2 text-xs font-semibold leading-snug text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.8)]">
          {video.title}
        </p>
        <p className="mt-1 text-[11px] font-medium text-white/85 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.8)]">
          {video.views} views
        </p>
      </div>

      <div className="absolute bottom-2.5 right-2.5 flex flex-col items-center gap-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-white">
          {video.creatorInitials}
        </div>
        <Link
          href="/app/bend"
          aria-label="Bend this script"
          title="Bend this script"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow-card transition-colors hover:bg-accent"
        >
          <Wand2 className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function NicheFinder() {
  const [platform, setPlatform] = useState<NicheFinderPlatform>("tiktok");
  const [timeframe, setTimeframe] = useState<NicheFinderTimeframe>("7d");
  const [search, setSearch] = useState("");

  const filteredNiches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return NICHE_SCORES;
    return NICHE_SCORES.filter((niche) => niche.name.toLowerCase().includes(query));
  }, [search]);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-heading">Niche Finder</h2>
            <p className="mt-1 max-w-xl text-sm text-body">
              Discover explosive social media trends, reverse-engineer viral frameworks, and identify
              high-revenue gaps.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search niches or topics..."
                aria-label="Search niches or topics"
                className="w-full rounded-full border border-hairline bg-surface py-2.5 pl-9 pr-4 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button variant="secondary" size="md" icon={Download} className="shrink-0">
              Export
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-hairline bg-surface p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PlatformToggle value={platform} onChange={setPlatform} />
            <TimeframeToggle value={timeframe} onChange={setTimeframe} />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-heading">Trending Niches</h3>
          <a
            href="#all-niches"
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline underline-offset-4"
          >
            See all trending niches
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {filteredNiches.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {filteredNiches.map((niche) => (
              <NicheScoreCard key={niche.id} niche={niche} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            No niches match &ldquo;{search}&rdquo;.
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-heading">Top Trending Videos</h2>
        <p className="mt-1 text-sm text-body">Calculated from video statistics in the last 7 days</p>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {TRENDING_VIDEOS.map((video) => (
            <TrendingVideoCard key={video.id} video={video} />
          ))}
        </div>
      </section>
    </div>
  );
}
