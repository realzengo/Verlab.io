import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { healTikTokCover } from "@/lib/server/tiktok-covers";

// A card asks for this when its TikTok cover isn't a stored copy yet (see
// useVideoCover). TikTok's scraped cover links are signed and expire within
// days, so this copies the cover into our own storage -- from a link we
// already have if it still works, otherwise from TikTok's video page -- points
// the video's rows at the copy, and redirects there. The next feed load
// serves the copy directly and never comes back here.

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
  // -- the image hosts fetched downstream come from our own rows or TikTok's
  // page, and tiktok-covers.ts allows only TikTok's CDNs.
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  const videoId = parsed.pathname.match(/\/(?:video|photo)\/(\d{5,25})/)?.[1];
  if (parsed.protocol !== "https:" || !/(^|\.)tiktok\.com$/.test(parsed.hostname) || !videoId) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const storedUrl = await healTikTokCover(createAdminClient(), videoId, videoUrl);
    if (!storedUrl) {
      // Not cached: TikTok may just be refusing us right now, so the next
      // view should try again.
      return NextResponse.json(
        { error: "No thumbnail available" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    const response = NextResponse.redirect(storedUrl, 302);
    // The stored copy's URL never changes, so the redirect itself is safe to
    // cache for as long as the copy is.
    response.headers.set("Cache-Control", "private, max-age=86400");
    return response;
  } catch (err) {
    console.error("[media/tiktok-thumb] failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch thumbnail" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
