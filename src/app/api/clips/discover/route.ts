import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { YoutubeError } from "@/lib/server/youtube-client";
import { discoverClipSources, searchClipSources } from "@/lib/server/clips/youtube";
import { isDiscoverCategory } from "@/lib/clips";

const QUERY_MAX = 100;

// "Or choose" grid: a category's long-form videos, or a search.
async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  // Normalized so "Joe Rogan" and "joe  rogan" share one cached search.
  const query = (params.get("q") ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, QUERY_MAX);
  const category = params.get("category") ?? "recommended";

  try {
    if (query) {
      // Each uncached search costs 100 of YouTube's 10,000 daily units.
      if (!(await checkRateLimit(`clips-search:${user.id}`, 10, 60))) {
        return rateLimitedResponse();
      }
      return NextResponse.json({ videos: await searchClipSources(query) });
    }
    if (!isDiscoverCategory(category)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }
    return NextResponse.json({ videos: await discoverClipSources(category) });
  } catch (error) {
    if (error instanceof YoutubeError && error.code === "quota_exceeded") {
      return NextResponse.json(
        { error: "YouTube search is resting until tomorrow. Paste a link instead." },
        { status: 503 }
      );
    }
    return serverError("clips/discover", error, "Couldn't load videos");
  }
}

export const GET = withApiLogging("/api/clips/discover", handleGET);
