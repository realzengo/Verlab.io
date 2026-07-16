import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverTrendingNiches } from "@/lib/server/niche-trend-ai";

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron requests carry this header automatically when deployed there;
  // fall back to a bearer token so the route can also be triggered manually
  // (local testing, a different scheduler) via `Authorization: Bearer $CRON_SECRET`.
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: run } = await admin
    .from("niche_refresh_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  try {
    const niches = await discoverTrendingNiches();

    if (niches.length === 0) {
      throw new Error("No niches returned");
    }

    const { error } = await admin.from("niches").upsert(
      niches.map((n) => ({
        slug: n.slug,
        name: n.name,
        category: n.category,
        description: n.description,
        faceless: n.faceless,
        tags: n.tags,
        platform: n.platform,
        momentum_score: n.momentumScore,
        momentum_trend: n.momentumTrend,
        sample_videos: n.sampleVideos.map((v, i) => ({
          id: `${n.slug}-v${i + 1}`,
          thumbnailUrl: "",
          title: v.title,
          views: v.views,
        })),
        refreshed_at: new Date().toISOString(),
      })),
      { onConflict: "slug" }
    );

    if (error) throw new Error(error.message);

    if (run) {
      await admin
        .from("niche_refresh_runs")
        .update({ status: "success", finished_at: new Date().toISOString(), niches_upserted: niches.length })
        .eq("id", run.id);
    }

    return NextResponse.json({ ok: true, upserted: niches.length });
  } catch (error) {
    console.error("[niches/refresh] failed:", error);
    const message = error instanceof Error ? error.message : "Refresh failed";
    if (run) {
      await admin
        .from("niche_refresh_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: message })
        .eq("id", run.id);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
