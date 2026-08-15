import { NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { serverError } from "@/lib/server/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyAndStoreChannel } from "@/lib/server/faceless-classifier";
import type { FacelessChannelVideo } from "@/lib/types";

// Gives the sequential classify loop below room to run without hitting the
// platform's default route timeout.
export const maxDuration = 300;

const ROW_COLUMNS =
  "id, channel_title, channel_description, subscriber_count, total_views, recent_videos, visual_tags, avatar_url";

// Caps how many channels one invocation processes so a single run stays
// comfortably inside maxDuration even if every Gemini call takes close to
// its own 45s timeout (see CLASSIFY_TIMEOUT_MS in faceless-classifier.ts).
// Re-clicking the admin button processes the next batch of whatever's still
// unclassified -- there's no separate "resume" concept needed for that.
const BATCH_LIMIT = 25;

interface UnclassifiedRow {
  id: string;
  channel_title: string;
  channel_description: string | null;
  subscriber_count: number | null;
  total_views: number | null;
  recent_videos: FacelessChannelVideo[] | null;
  visual_tags: string[] | null;
  avatar_url: string | null;
}

/**
 * Classifies every not-yet-verified niche_channels row (verified_at IS NULL
 * -- classifyAndStoreChannel always sets is_faceless and verified_at
 * together, so that single predicate covers both "never classified" and
 * "classification never stored"). Streams one NDJSON line per channel as it
 * finishes so the admin UI can render live progress instead of waiting on
 * one big response.
 */
export async function POST(): Promise<Response> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("niche_channels")
    .select(ROW_COLUMNS)
    .is("verified_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT)
    .returns<UnclassifiedRow[]>();

  if (error) {
    return serverError("admin/niches/batch-classify", error);
  }

  const channels = rows ?? [];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      send({ type: "start", total: channels.length });

      let classified = 0;
      let failed = 0;

      for (const row of channels) {
        try {
          const classification = await classifyAndStoreChannel(
            row.id,
            {
              channelTitle: row.channel_title,
              channelDescription: row.channel_description ?? "",
              subscriberCount: row.subscriber_count ?? 0,
              totalViews: row.total_views ?? 0,
              recentVideos: row.recent_videos ?? [],
              visualTags: row.visual_tags ?? [],
              avatarUrl: row.avatar_url ?? undefined,
            },
            admin
          );
          classified += 1;
          send({
            type: "progress",
            channelId: row.id,
            channelTitle: row.channel_title,
            ok: true,
            classification,
            classified,
            failed,
            total: channels.length,
          });
        } catch (err) {
          failed += 1;
          const message = err instanceof Error ? err.message : "Classification failed";
          console.error(`[batch-classify] channel ${row.id} failed:`, err);
          send({
            type: "progress",
            channelId: row.id,
            channelTitle: row.channel_title,
            ok: false,
            error: message,
            classified,
            failed,
            total: channels.length,
          });
        }
      }

      send({ type: "done", classified, failed, total: channels.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
