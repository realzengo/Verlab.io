import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// TikTok's scraped cover_url (SociaVault -> trending_videos.cover_url) is a
// signed CDN URL with a short embedded expiry -- a row that's more than a
// few hours old (a quiet cron gap, or just the niche cache's 24h TTL, see
// niche-video-refresh.ts) ends up serving a dead image, which the client
// card's onError silently swallows into a blank gradient. Rather than
// depend on that stored URL staying valid, this re-mints a fresh one on
// demand via TikTok's public oEmbed endpoint (no auth, no scrape credits)
// and proxies the bytes through our own origin so the browser never talks
// to TikTok's CDN directly (sidesteps referer/hotlink rejections too).

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const videoUrl = request.nextUrl.searchParams.get("url");
  if (!videoUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Constrained to tiktok.com itself (not an arbitrary client-supplied host)
  // -- the actual image host we fetch from below always comes from TikTok's
  // own oEmbed response, never from this param directly.
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !/(^|\.)tiktok\.com$/.test(parsed.hostname)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!oembedRes.ok) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    const oembed = (await oembedRes.json().catch(() => null)) as { thumbnail_url?: string } | null;
    const thumbnailUrl = oembed?.thumbnail_url;
    if (!thumbnailUrl) {
      return NextResponse.json({ error: "No thumbnail available" }, { status: 404 });
    }

    const imageRes = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!imageRes.ok || !imageRes.body) {
      return NextResponse.json({ error: "Thumbnail fetch failed" }, { status: 502 });
    }

    const contentType = imageRes.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
    }
    const contentLength = Number(imageRes.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(imageRes.body, {
      headers: {
        "Content-Type": contentType,
        // oEmbed mints a brand-new signed URL on every call, so a freshly
        // proxied image is good for as long as this response is cached --
        // no need to ever re-check the origin.
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[media/tiktok-thumb] failed:", err);
    return NextResponse.json({ error: "Failed to fetch thumbnail" }, { status: 502 });
  }
}
