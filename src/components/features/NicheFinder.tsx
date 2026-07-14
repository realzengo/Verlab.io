"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Play, TrendingUp, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface TrendingNiche {
  rank: number;
  id: string;
  name: string;
  weeklyChange: string;
  momentum: number;
  videos: string;
  avgViews: string;
  rpm: string;
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

const TRENDING_NICHES: TrendingNiche[] = [
  {
    rank: 1,
    id: "medical-malpractice",
    name: "Medical Malpractice",
    weeklyChange: "+34%",
    momentum: 94,
    videos: "1.2k",
    avgViews: "150k",
    rpm: "$4.50",
  },
  {
    rank: 2,
    id: "corporate-espionage",
    name: "Corporate Espionage",
    weeklyChange: "+28%",
    momentum: 88,
    videos: "860",
    avgViews: "132k",
    rpm: "$3.90",
  },
  {
    rank: 3,
    id: "financial-collapse",
    name: "Financial Collapse",
    weeklyChange: "+11%",
    momentum: 81,
    videos: "740",
    avgViews: "121k",
    rpm: "High",
  },
  {
    rank: 4,
    id: "military-disasters",
    name: "Military Disasters",
    weeklyChange: "+19%",
    momentum: 76,
    videos: "610",
    avgViews: "98k",
    rpm: "$3.20",
  },
  {
    rank: 5,
    id: "cult-breakdowns",
    name: "Cult Breakdowns",
    weeklyChange: "+9%",
    momentum: 72,
    videos: "540",
    avgViews: "87k",
    rpm: "High",
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

function NicheMetricCard({ niche }: { niche: TrendingNiche }) {
  return (
    <Link
      href="/app/bend"
      className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold leading-snug text-heading">
          <span className="text-primary">#{niche.rank}</span> {niche.name}
        </p>
        <Badge variant="success" className="shrink-0 whitespace-nowrap">
          <TrendingUp className="h-3 w-3" />
          {niche.weeklyChange} this week
        </Badge>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-app">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${niche.momentum}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-body">Videos</p>
          <p className="mt-0.5 text-sm font-semibold text-heading">{niche.videos}</p>
        </div>
        <div className="border-x border-hairline">
          <p className="text-[10px] uppercase tracking-wide text-body">Avg views</p>
          <p className="mt-0.5 text-sm font-semibold text-heading">{niche.avgViews}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-body">RPM</p>
          <p className="mt-0.5 text-sm font-semibold text-heading">{niche.rpm}</p>
        </div>
      </div>
    </Link>
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
  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-heading">Top Trending Niches</h2>
          <a
            href="#all-niches"
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline underline-offset-4"
          >
            See all trending niches
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TRENDING_NICHES.map((niche) => (
            <NicheMetricCard key={niche.id} niche={niche} />
          ))}
        </div>
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
