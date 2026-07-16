import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordUsageEvent } from "@/lib/server/usage";
import {
  detectTranscriptPlatform,
  fetchTranscript,
  humanizeVideoProviderError,
} from "@/lib/server/video-provider";

async function runExtraction(supabase: SupabaseClient, id: string, url: string): Promise<void> {
  try {
    await supabase.from("transcripts").update({ status: "processing" }).eq("id", id);
    const result = await fetchTranscript(url);
    await supabase
      .from("transcripts")
      .update({
        status: "complete",
        title: result.title,
        cover_url: result.coverUrl,
        duration_seconds: result.durationSeconds,
        video_url: result.videoUrl,
        embed_url: result.embedUrl,
        lines: result.lines,
      })
      .eq("id", id);
  } catch (error) {
    console.error("[transcripts] extraction failed:", error);
    await supabase
      .from("transcripts")
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

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const platform = detectTranscriptPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "Only TikTok, Instagram Reels, and YouTube Shorts links are supported" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("transcripts")
    .insert({ user_id: user.id, source_url: url, platform, status: "queued" })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not start extraction" }, { status: 500 });
  }

  void runExtraction(supabase, data.id, url);
  void recordUsageEvent("transcripts", user.id, { transcriptId: data.id });

  return NextResponse.json({ id: data.id });
}
