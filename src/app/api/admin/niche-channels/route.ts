import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { getNicheChannelsForAdmin } from "@/lib/server/admin-queries";
import { ingestChannel, FacelessIngestError } from "@/lib/server/faceless-ingest";
import { NAME_MAX, URL_MAX, isValidName, isValidUrl } from "@/lib/validation";
import type { NicheBendPlatform, NicheBendVideoType } from "@/lib/types";

const PLATFORMS: NicheBendPlatform[] = ["youtube", "tiktok"];
const VIDEO_TYPES: NicheBendVideoType[] = ["shorts", "long-form"];

// Lists every ingested channel (any classification status) for the admin
// "channels" table -- unlike /api/niches/faceless, this is not filtered to
// is_faceless/confidence, so admins can see and classify unverified rows too.
// Reuses the same admin-queries mapper the page's SSR fetch uses, so this
// route and the initial server-rendered list always agree on shape
// (camelCase AdminNicheChannel) -- returning raw snake_case rows here would
// silently blank every field for any client-side refetch of this route.
export async function GET(): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const channels = await getNicheChannelsForAdmin();
  return NextResponse.json({ channels });
}

// Ingests a new channel (scrapes top videos via the existing Apify/
// ScrapeCreators pipeline, upserts a niche_channels row) so it's ready for
// the "Auto-Classify with AI" action. Does not classify it -- that's a
// separate step (POST /api/admin/niche-channels/[id]/classify) so the admin
// can preview the verdict before it's stored.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { url?: string; platform?: string; niche?: string; videoType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.url || !PLATFORMS.includes(body.platform as NicheBendPlatform)) {
    return NextResponse.json({ error: "url and a valid platform ('youtube' | 'tiktok') are required" }, { status: 400 });
  }

  if (!isValidUrl(body.url, URL_MAX)) {
    return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 });
  }

  if (body.niche != null && body.niche.trim() && !isValidName(body.niche.trim(), NAME_MAX)) {
    return NextResponse.json({ error: "niche contains invalid characters or is too long" }, { status: 400 });
  }

  const videoType = VIDEO_TYPES.includes(body.videoType as NicheBendVideoType)
    ? (body.videoType as NicheBendVideoType)
    : undefined;

  try {
    const result = await ingestChannel(body.url, body.platform as NicheBendPlatform, {
      videoType,
      niche: body.niche,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof FacelessIngestError ? error.message : "Failed to ingest channel";
    console.error("[admin/niche-channels] ingest failed:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
