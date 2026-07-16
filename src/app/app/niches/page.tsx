import { createClient } from "@/lib/supabase/server";
import { NicheCard } from "@/components/features/NicheCard";
import { NicheFinder } from "@/components/features/NicheFinder";
import type { Niche, TrendingVideo } from "@/lib/types";

interface NicheRow {
  id: string;
  name: string;
  category: string;
  momentum_score: number;
  momentum_trend: "up" | "down" | "flat";
  description: string;
  faceless: boolean;
  tags: string[];
  platform: Niche["platform"];
  sample_videos: Niche["sampleVideos"];
}

interface TrendingVideoRow {
  id: string;
  title: string;
  views: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  follower_count: number;
  cover_url: string;
  video_url: string;
  author: string;
  avatar_url: string;
  hashtag: string;
  posted_at: string | null;
}

export default async function NichesPage() {
  const supabase = await createClient();
  const [{ data: nicheRows }, { data: trendingVideoRows }] = await Promise.all([
    supabase
      .from("niches")
      .select("id, name, category, momentum_score, momentum_trend, description, faceless, tags, platform, sample_videos")
      .order("momentum_score", { ascending: false }),
    supabase
      .from("trending_videos")
      .select(
        "id, title, views, view_count, like_count, comment_count, share_count, follower_count, cover_url, video_url, author, avatar_url, hashtag, posted_at"
      )
      .order("view_count", { ascending: false })
      .limit(200),
  ]);

  const niches: Niche[] = ((nicheRows as NicheRow[]) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    momentumScore: row.momentum_score,
    momentumTrend: row.momentum_trend,
    description: row.description,
    faceless: row.faceless,
    tags: row.tags,
    platform: row.platform,
    sampleVideos: row.sample_videos,
  }));

  const trendingVideos: TrendingVideo[] = ((trendingVideoRows as TrendingVideoRow[]) ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    views: row.views,
    viewCount: row.view_count,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    followerCount: row.follower_count,
    coverUrl: row.cover_url,
    videoUrl: row.video_url,
    author: row.author,
    avatarUrl: row.avatar_url,
    hashtag: row.hashtag,
    postedAt: row.posted_at,
  }));

  return (
    <div className="flex flex-col gap-10 mt-16">
      <NicheFinder niches={niches} trendingVideos={trendingVideos} />

      <div id="all-niches" className="flex flex-col gap-6 scroll-mt-6">
        <div>
          <h2 className="text-lg font-semibold text-heading">All niches</h2>
          <p className="mt-1 text-sm text-body">
            Trending faceless niches ranked by momentum score. Pick one to bend into your own topic.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {niches.map((niche) => (
            <NicheCard key={niche.id} niche={niche} bendHref="/app/bend" />
          ))}
        </div>
      </div>
    </div>
  );
}
