import { NextResponse } from "next/server";

// The video downloader (TikTok / YouTube / Instagram / Facebook) was removed
// from Verlab on 2026-11-26. Its old API routes stay as stubs so any old
// client, bookmark or script gets a clear answer instead of a 404.

export const DOWNLOADER_REMOVED_MESSAGE =
  "This feature is no longer available. The video downloader has been removed from Verlab.";

export function downloaderRemoved(): NextResponse {
  return NextResponse.json({ error: DOWNLOADER_REMOVED_MESSAGE, code: "feature_removed" }, { status: 410 });
}
