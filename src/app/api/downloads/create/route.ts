import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordUsageEvent } from "@/lib/server/usage";
import {
  detectDownloadPlatform,
  fetchDownloadLink,
  humanizeVideoProviderError,
} from "@/lib/server/video-provider";
import type { DownloadFormat } from "@/lib/types";

async function runDownload(supabase: SupabaseClient, id: string, url: string, format: DownloadFormat): Promise<void> {
  try {
    await supabase.from("downloads").update({ status: "processing" }).eq("id", id);
    const result = await fetchDownloadLink(url, format);
    // Storing the provider's direct URL for now — provider-signed URLs can
    // expire, so re-hosting into Supabase Storage is the natural next step
    // if "Download Again" needs to keep working long-term.
    await supabase
      .from("downloads")
      .update({ status: "complete", title: result.title, file_path: result.directUrl })
      .eq("id", id);
  } catch (error) {
    console.error("[downloads] download failed:", error);
    await supabase
      .from("downloads")
      .update({ status: "failed", error_message: humanizeVideoProviderError(error) })
      .eq("id", id);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { url?: string; format?: DownloadFormat };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const format = body.format === "mp3" ? "mp3" : "mp4";

  const platform = detectDownloadPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "Only TikTok, YouTube, and Instagram links are supported" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("downloads")
    .insert({ user_id: user.id, source_url: url, platform, format, status: "queued" })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not start download" }, { status: 500 });
  }

  void runDownload(supabase, data.id, url, format);
  void recordUsageEvent("downloader", user.id, { downloadId: data.id });

  return NextResponse.json({ id: data.id });
}
