import { NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverAndIngestTrendingYoutubeChannels } from "@/lib/server/faceless-youtube-discovery";
import { YoutubeError } from "@/lib/server/youtube-client";

// Gives discovery room to run without hitting the platform's default route
// timeout.
export const maxDuration = 300;

/**
 * YouTube counterpart to /api/admin/niches/ingest-tiktok -- discovers real
 * trending YouTube channels via youtube-client.ts's search.list wrapper and
 * upserts them into niche_channels, raw and unclassified. See the comment in
 * ingest-tiktok/route.ts for why there's no Gemini pass here anymore.
 */
export async function POST(): Promise<Response> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const discovered = await discoverAndIngestTrendingYoutubeChannels(admin);
    return NextResponse.json({ ingestedCount: discovered.length });
  } catch (err) {
    const message = err instanceof YoutubeError ? err.message : "Failed to discover trending YouTube channels";
    console.error("[ingest-youtube] discovery failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
