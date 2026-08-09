import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { getFacelessChannels } from "@/lib/server/faceless-queries";
import type { FacelessSort, NicheBendPlatform } from "@/lib/types";

const SORTS: FacelessSort[] = ["trending", "newest", "views"];
const PLATFORMS: NicheBendPlatform[] = ["youtube", "tiktok"];

function parseSort(value: string | null): FacelessSort {
  return SORTS.includes(value as FacelessSort) ? (value as FacelessSort) : "trending";
}

function parsePlatform(value: string | null): NicheBendPlatform | undefined {
  return PLATFORMS.includes(value as NicheBendPlatform) ? (value as NicheBendPlatform) : undefined;
}

function parseIntParam(value: string | null, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = await getFacelessChannels(supabase, {
    niche: searchParams.get("niche") ?? undefined,
    complexity: searchParams.get("complexity") ?? undefined,
    style: searchParams.get("style") ?? undefined,
    platform: parsePlatform(searchParams.get("platform")),
    sort: parseSort(searchParams.get("sort")),
    page: parseIntParam(searchParams.get("page"), 1),
    pageSize: parseIntParam(searchParams.get("pageSize"), 24),
  });

  return NextResponse.json(
    {
      channels: page.channels,
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        hasMore: page.hasMore,
      },
    },
    {
      headers: {
        // Verified faceless channels change only when the classifier or an
        // admin override runs, not per-request -- safe to cache briefly at
        // the edge/CDN while staying fresh via revalidation in the background.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

export const GET = withApiLogging("/api/niches/faceless", handleGET);
