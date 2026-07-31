import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDownloadFormatOption, type DownloadFormat } from "@/lib/types";
import { fetchDownloadLink, humanizeVideoProviderError } from "@/lib/server/video-provider";
import { withApiLogging } from "@/lib/server/api-logging";

// Mimics a browser request — some CDNs (TikTok/YouTube/Facebook's providers
// included) reject fetches with no User-Agent as bot traffic.
const UPSTREAM_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function sanitizeFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/[^\x00-\x7F]+/g, "")
    .trim();
  return (cleaned || "video").slice(0, 100);
}

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("downloads")
    .select("status, title, file_path, format, source_url")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (data.status !== "complete" || !data.file_path) {
    return NextResponse.json({ error: "That download isn't ready yet" }, { status: 400 });
  }

  let fileUrl = data.file_path;
  let upstream = await fetch(fileUrl, { headers: UPSTREAM_FETCH_HEADERS });

  // The provider's direct link is signed and short-lived — if it's gone
  // stale by the time the user clicks download, mint a fresh one and retry
  // once instead of failing outright.
  if (!upstream.ok || !upstream.body) {
    console.error(`[downloads] stored file link failed (${upstream.status}) for ${id}, refreshing`);
    try {
      const fresh = await fetchDownloadLink(data.source_url, data.format as DownloadFormat);
      fileUrl = fresh.directUrl;
      await supabase.from("downloads").update({ file_path: fileUrl }).eq("id", id);
      upstream = await fetch(fileUrl, { headers: UPSTREAM_FETCH_HEADERS });
    } catch (error) {
      console.error("[downloads] failed to refresh expired download link:", error);
      return NextResponse.json({ error: humanizeVideoProviderError(error) }, { status: 502 });
    }
  }

  if (!upstream.ok || !upstream.body) {
    console.error(`[downloads] upstream file fetch still failing (${upstream.status}) for ${id} after refresh`);
    return NextResponse.json({ error: "The video file is no longer available" }, { status: 502 });
  }

  const formatOption = getDownloadFormatOption(data.format);
  const extension = formatOption?.extension ?? "mp4";
  const rawTitle = data.title ?? "video";
  const asciiFilename = `${sanitizeFilename(rawTitle)}.${extension}`;
  const utf8Filename = `${rawTitle.replace(/[\\/:*?"<>|]+/g, "").trim() || "video"}.${extension}`;
  const contentType = formatOption?.contentType ?? "video/mp4";

  // "Open in new tab" wants the browser to play the video inline; plain
  // downloads (and the default) should still force a save-to-disk prompt.
  const disposition = request.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `${disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`,
  });
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { headers });
}

export const GET = withApiLogging("/api/downloads/file/[id]", handleGET);
