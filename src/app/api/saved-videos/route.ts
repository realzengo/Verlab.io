import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";

// Mirrors TrendingVideo (src/lib/types.ts) — the client sends the full video
// object it already has in hand rather than round-tripping to re-fetch it,
// since it's about to be denormalized into saved_videos anyway (see the
// migration's comment on why: trending_videos rows get purged/expire).
const SaveVideoSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  views: z.string(),
  viewCount: z.number(),
  likeCount: z.number(),
  commentCount: z.number(),
  shareCount: z.number(),
  followerCount: z.number(),
  coverUrl: z.string(),
  videoUrl: z.string(),
  author: z.string(),
  avatarUrl: z.string(),
  hashtag: z.string(),
  niche: z.string(),
  postedAt: z.string().nullable(),
  platform: z.enum(["tiktok", "youtube"]),
});

async function routeGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("saved_videos")
    .select(
      "video_id, platform, title, views, view_count, like_count, comment_count, share_count, follower_count, cover_url, video_url, author, avatar_url, hashtag, niche, posted_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[saved-videos] list failed:", error.message);
    return NextResponse.json({ error: "Couldn't load saved videos." }, { status: 500 });
  }

  const videos = (data ?? []).map((row) => ({
    id: row.video_id,
    platform: row.platform,
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
    niche: row.niche,
    postedAt: row.posted_at,
  }));

  return NextResponse.json({ videos });
}

async function routePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SaveVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid video payload" }, { status: 400 });
  }
  const v = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("saved_videos").upsert(
    {
      user_id: user.id,
      video_id: v.id,
      platform: v.platform,
      title: v.title,
      views: v.views,
      view_count: v.viewCount,
      like_count: v.likeCount,
      comment_count: v.commentCount,
      share_count: v.shareCount,
      follower_count: v.followerCount,
      cover_url: v.coverUrl,
      video_url: v.videoUrl,
      author: v.author,
      avatar_url: v.avatarUrl,
      hashtag: v.hashtag,
      niche: v.niche,
      posted_at: v.postedAt,
    },
    { onConflict: "user_id,video_id" }
  );

  if (error) {
    console.error("[saved-videos] save failed:", error.message);
    return NextResponse.json({ error: "Couldn't save video." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const GET = withApiLogging("/api/saved-videos", routeGET);
export const POST = withApiLogging("/api/saved-videos", routePOST);
