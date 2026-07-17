import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/server/niche-bend-job-store";
import { createClient } from "@/lib/supabase/server";
import type { NicheBendHistoryItem } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;

  const rows = await listJobs(supabase, limit, { savedOnly: true });

  const items: NicheBendHistoryItem[] = rows.map((row) => ({
    jobId: row.id,
    sourceUrl: row.source_url,
    platform: row.platform,
    videoType: row.video_type,
    status: row.status,
    channelName: row.analysis?.channelName ?? null,
    avatarUrl: row.analysis?.avatarUrl ?? null,
    detectedNiche: row.analysis?.detectedNiche ?? null,
    chosenBend: row.chosen_bend,
    saved: row.saved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ items });
}
