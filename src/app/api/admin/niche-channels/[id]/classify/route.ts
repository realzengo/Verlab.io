import { NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyChannel, FacelessClassifierError } from "@/lib/server/faceless-classifier";
import type { FacelessChannelVideo } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ROW_COLUMNS =
  "id, channel_title, channel_description, subscriber_count, total_views, recent_videos, visual_tags, avatar_url";

// Runs the Gemini classifier for one channel and returns the verdict as a
// PREVIEW only -- it deliberately does not write to niche_channels. The
// admin reviews is_faceless/confidence_score/reasoning in the UI, then
// approves or overrides via PATCH /api/admin/niche-channels/[id], which is
// the only step that actually persists a verdict.
export async function POST(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: row, error: fetchError } = await admin.from("niche_channels").select(ROW_COLUMNS).eq("id", id).single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  try {
    const classification = await classifyChannel({
      channelTitle: row.channel_title,
      channelDescription: row.channel_description ?? "",
      subscriberCount: row.subscriber_count ?? 0,
      totalViews: row.total_views ?? 0,
      recentVideos: (row.recent_videos ?? []) as FacelessChannelVideo[],
      visualTags: row.visual_tags ?? [],
      avatarUrl: row.avatar_url ?? undefined,
    });

    return NextResponse.json({ channelId: id, classification });
  } catch (error) {
    const message = error instanceof FacelessClassifierError ? error.message : "Classification failed";
    console.error("[admin/niche-channels/classify] failed:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
