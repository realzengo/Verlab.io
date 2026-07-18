import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/[^\x00-\x7F]+/g, "")
    .trim();
  return (cleaned || "video").slice(0, 100);
}

export async function GET(
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
    .select("status, title, file_path, format")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (data.status !== "complete" || !data.file_path) {
    return NextResponse.json({ error: "That download isn't ready yet" }, { status: 400 });
  }

  const upstream = await fetch(data.file_path);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "The video file is no longer available" }, { status: 502 });
  }

  const extension = data.format === "mp3" ? "mp3" : "mp4";
  const rawTitle = data.title ?? "video";
  const asciiFilename = `${sanitizeFilename(rawTitle)}.${extension}`;
  const utf8Filename = `${rawTitle.replace(/[\\/:*?"<>|]+/g, "").trim() || "video"}.${extension}`;
  const contentType = data.format === "mp3" ? "audio/mpeg" : "video/mp4";

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`,
  });
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { headers });
}
