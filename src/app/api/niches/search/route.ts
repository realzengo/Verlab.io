import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isNicheName } from "@/lib/niches-catalog";
import type { VideoPlatform } from "@/lib/server/niche-video-refresh";
import { searchNicheVideos, NicheVideoSearchError, type SearchSort } from "@/lib/server/niche-video-search";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";

// Pure DB read (no live scrape triggering, see searchNicheVideos) -- well
// under the 60s ceiling the scrape-capable routes need.
export const maxDuration = 30;

interface SearchRequestBody {
  niche?: string;
  platform?: string;
  style?: string;
  country?: string;
  viewsMin?: number | string | null;
  viewsMax?: number | string | null;
  followersMin?: number | string | null;
  followersMax?: number | string | null;
  postedAfter?: string | null;
  postedBefore?: string | null;
  q?: string | null;
  sort?: string;
  limit?: number;
  cursor?: string | null;
}

function parsePlatform(raw: unknown): VideoPlatform | "all" {
  return raw === "tiktok" || raw === "youtube" ? raw : "all";
}

function parseSort(raw: unknown): SearchSort {
  return raw === "newest" ? "newest" : "views";
}

async function routePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: SearchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const niche = body.niche && body.niche !== "all" ? body.niche : null;
  if (niche && !isNicheName(niche)) {
    return NextResponse.json({ error: `Unknown niche "${niche}"` }, { status: 400 });
  }

  const limit = Math.min(50, Math.max(1, Number(body.limit) || 20));

  try {
    const result = await searchNicheVideos({
      niche,
      platform: parsePlatform(body.platform),
      style: body.style ?? "all",
      country: (body.country ?? "").trim().toUpperCase(),
      viewsMin: body.viewsMin ?? null,
      viewsMax: body.viewsMax ?? null,
      followersMin: body.followersMin ?? null,
      followersMax: body.followersMax ?? null,
      postedAfter: body.postedAfter ?? null,
      postedBefore: body.postedBefore ?? null,
      q: body.q ?? null,
      sort: parseSort(body.sort),
      limit,
      cursor: body.cursor ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NicheVideoSearchError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return serverError("niches/search", error);
  }
}

export const POST = withApiLogging("/api/niches/search", routePOST);
