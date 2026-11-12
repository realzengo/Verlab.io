import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { humanizeVideoProviderError } from "@/lib/server/video-provider";
import { Fmp4CutError, cutFragmentedMp4Ranges } from "@/lib/server/clips/fmp4-cut";
import type { ClipProjectRow } from "@/lib/server/clips/projects";
import { openClipSource, paddedCutRange } from "@/lib/server/clips/cut-source";
import { CLIP_MAX_SECONDS } from "@/lib/clips";
import { SEGMENT_ALL, SEGMENT_FRAME, SEGMENT_MAX_RANGES, encodeSegmentFrame, float64 } from "@/lib/clip-segments";

// Cuts several clips out of one read of the source video (see fmp4-cut.ts)
// and streams them back as they're passed, with progress, in the frame
// format of lib/clip-segments.ts. The provider's stream has no Range
// support, so reaching a clip means reading everything before it; one read
// for all clips pays that once, and the first clips arrive early.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Reading stops a little before the route's own limit, so unfinished clips
// get an error frame instead of the response being cut off mid-body.
const UPSTREAM_TIMEOUT_MS = 285_000;

type Range = { start: number; end: number };

function readRanges(body: unknown, duration: number): Range[] | null {
  const raw = (body as { ranges?: unknown } | null)?.ranges;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > SEGMENT_MAX_RANGES) return null;
  const ranges: Range[] = [];
  for (const item of raw) {
    const start = Number((item as Range)?.start);
    const end = Number((item as Range)?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
    if (end > duration + 1 || end - start > CLIP_MAX_SECONDS) return null;
    ranges.push({ start, end });
  }
  return ranges;
}

async function handlePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`clips-segments:${user.id}`, 20, 60))) {
    return rateLimitedResponse();
  }

  const { data: row } = await supabase
    .from("clip_projects")
    .select("id, source_url, duration_seconds, media_url, status")
    .eq("id", id)
    .maybeSingle<Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds" | "media_url" | "status">>();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "ready") {
    return NextResponse.json({ error: "This project isn't ready yet" }, { status: 409 });
  }

  const ranges = readRanges(await request.json().catch(() => null), row.duration_seconds);
  if (!ranges) {
    return NextResponse.json({ error: "Invalid clip ranges" }, { status: 400 });
  }

  const upstream = new AbortController();
  const timeout = setTimeout(() => upstream.abort(), UPSTREAM_TIMEOUT_MS);
  let source: ReadableStream<Uint8Array>;
  try {
    source = await openClipSource(row, upstream.signal);
  } catch (error) {
    clearTimeout(timeout);
    console.error("[clips/segments] source unavailable:", error);
    return NextResponse.json({ error: humanizeVideoProviderError(error) }, { status: 502 });
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const finished = new Set<number>();

  void (async () => {
    try {
      await cutFragmentedMp4Ranges(
        source,
        ranges.map(paddedCutRange),
        async (event) => {
          if (event.type === "start") {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.start, event.index, float64(event.offset)));
          } else if (event.type === "data") {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.data, event.index, event.bytes));
          } else if (event.type === "end") {
            finished.add(event.index);
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.end, event.index));
          } else {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.progress, 0, float64(event.time)));
          }
        }
      );
    } catch (error) {
      console.error("[clips/segments] cut failed:", error);
      const message =
        error instanceof Fmp4CutError
          ? "This video's source format can't be cut. Try another video."
          : upstream.signal.aborted
            ? "Reading the video took too long to reach this clip. Try again, or pick a clip earlier in the video."
            : "We couldn't read the source video. Try again.";
      if (finished.size < ranges.length) {
        await writer
          .write(encodeSegmentFrame(SEGMENT_FRAME.error, SEGMENT_ALL, new TextEncoder().encode(message)))
          .catch(() => {});
      }
    } finally {
      clearTimeout(timeout);
      upstream.abort();
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
  });
}

export const POST = withApiLogging("/api/clips/[id]/segments", handlePOST);
