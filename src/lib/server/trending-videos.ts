import type { TrendingVideo } from "@/lib/types";
import { nicheForHashtag } from "@/lib/niches-catalog";

export interface TrendingVideoRow {
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
  niche_category: string | null;
  posted_at: string | null;
  platform: "tiktok" | "youtube";
}

export const TRENDING_VIDEO_COLUMNS =
  "id, title, views, view_count, like_count, comment_count, share_count, follower_count, cover_url, video_url, author, avatar_url, hashtag, niche_category, posted_at, platform";

// niche_category is backfilled going forward, but rows ingested before that
// column existed fall back to the hashtag-derived niche so old cache entries
// still display correctly.
export function mapTrendingVideoRow(row: TrendingVideoRow): TrendingVideo {
  return {
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
    niche: row.niche_category ?? nicheForHashtag(row.hashtag),
    postedAt: row.posted_at,
    platform: row.platform,
  };
}
