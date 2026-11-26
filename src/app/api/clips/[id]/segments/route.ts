import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { humanizeVideoProviderError } from "@/lib/server/video-provider";
import { Fmp4CutError } from "@/lib/server/clips/fmp4-cut";
import type { ClipProjectRow } from "@/lib/server/clips/projects";
import {
  TRIM_AFTER_SECONDS,
  cutClipSource,
  cutTrimmedRanges,
  openClipSource,
  paddedCutRange,
} from "@/lib/server/clips/cut-source";
import { CLIP_MAX_SECONDS } from "@/lib/clips";
import { SEGMENT_ALL, SEGMENT_FRAME, SEGMENT_MAX_RANGES, encodeSegmentFrame, float64 } from "@/lib/clip-segments";
import { requirePaidPlan } from "@/lib/server/subscription";

// Cuts several clips out of the source video (see fmp4-cut.ts) and streams
// them back as they're done, with progress, in the frame format of
// lib/clip-segments.ts. The provider's stream has no Range support, so
// reaching a clip means reading everything before it: clips near the start
// share one read of the stream (progress for all of them, index SEGMENT_ALL),
// and clips further in each come from a trimmed download of their own,
// several at once (progress per clip, by its index, scaled to its start).
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Reading stops a little before the route's own limit, so unfinished clips
// get an error frame instead of the response being cut off mid-body.
const UPSTREAM_TIMEOUT_MS = 285_000;
const STREAM_ENDED_MESSAGE = "The video stream stopped before this clip. Try again.";

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

  const planRequired = await requirePaidPlan(user);
  if (planRequired) return planRequired;

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

  const body = await request.json().catch(() => null);
  const ranges = readRanges(body, row.duration_seconds);
  if (!ranges) {
    return NextResponse.json({ error: "Invalid clip ranges" }, { status: 400 });
  }
  // A retry after a broken read asks for a fresh provider link.
  const fresh = (body as { fresh?: unknown } | null)?.fresh === true;

  const near = ranges.map((_, index) => index).filter((index) => ranges[index].start < TRIM_AFTER_SECONDS);
  const deep = ranges.map((_, index) => index).filter((index) => ranges[index].start >= TRIM_AFTER_SECONDS);

  const upstream = new AbortController();
  const timeout = setTimeout(() => upstream.abort(), UPSTREAM_TIMEOUT_MS);
  let source: ReadableStream<Uint8Array> | null = null;
  if (near.length) {
    try {
      source = await openClipSource(row, upstream.signal, { fresh });
    } catch (error) {
      console.error("[clips/segments] source unavailable:", error);
      if (!deep.length) {
        clearTimeout(timeout);
        return NextResponse.json({ error: humanizeVideoProviderError(error) }, { status: 502 });
      }
    }
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const finished = new Set<number>();
  const encoder = new TextEncoder();
  /** Error frames for every clip of `indices` that hasn't ended. */
  const failRest = async (indices: number[], message: string) => {
    for (const index of indices) {
      if (finished.has(index)) continue;
      finished.add(index);
      await writer.write(encodeSegmentFrame(SEGMENT_FRAME.error, index, encoder.encode(message))).catch(() => {});
    }
  };

  /** Clips near the start: one read of the stream, cut as the read passes them. */
  const readNear = async () => {
    if (!near.length) return;
    if (!source) {
      await failRest(near, "We couldn't read the source video. Try again.");
      return;
    }
    try {
      await cutClipSource(
        row,
        source,
        near.map((index) => paddedCutRange(ranges[index])),
        async (event) => {
          if (event.type === "progress") {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.progress, SEGMENT_ALL, float64(event.time)));
            return;
          }
          const index = near[event.index];
          if (event.type === "start") {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.start, index, float64(event.offset)));
          } else if (event.type === "data") {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.data, index, event.bytes));
          } else if (event.type === "end") {
            finished.add(index);
            if (event.audio < 0.8) {
              // The editor fills the missing sound from the project's mp3; logged to see how often.
              console.warn(`[clips/segments] ${row.id} range ${index}: ${Math.round(event.audio * 100)}% has sound`);
            }
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.end, index));
          } else {
            // The stream ended before this clip did; the editor reads it again on a fresh link.
            finished.add(index);
            console.warn(`[clips/segments] ${row.id} range ${index}: stream ended early`);
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.error, index, encoder.encode(STREAM_ENDED_MESSAGE)));
          }
        },
        upstream.signal
      );
    } catch (error) {
      console.error("[clips/segments] cut failed:", error);
      await failRest(
        near,
        error instanceof Fmp4CutError
          ? "This video's source format can't be cut. Try another video."
          : upstream.signal.aborted
            ? "Reading the video took too long to reach this clip. Try again."
            : "We couldn't read the source video. Try again."
      );
    }
  };

  /** Clips further in: a trimmed download each, handed over whole. */
  const cutDeep = async () => {
    if (!deep.length) return;
    try {
      await cutTrimmedRanges(
        row,
        deep.map((index) => paddedCutRange(ranges[index])),
        async (event) => {
          const index = deep[event.index];
          if (event.type === "start") {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.start, index, float64(event.offset)));
          } else if (event.type === "data") {
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.data, index, event.bytes));
          } else if (event.type === "end") {
            finished.add(index);
            await writer.write(encodeSegmentFrame(SEGMENT_FRAME.end, index));
          } else {
            await failRest([index], "We couldn't load this clip from the video. Try again.");
          }
        },
        upstream.signal,
        {
          onRangeProgress: (position, fraction) => {
            const index = deep[position];
            // The editor shows a clip's progress against its start time.
            void writer
              .write(encodeSegmentFrame(SEGMENT_FRAME.progress, index, float64(ranges[index].start * fraction)))
              .catch(() => {});
          },
        }
      );
    } catch (error) {
      console.error("[clips/segments] trimmed cuts failed:", error);
    }
    await failRest(
      deep,
      upstream.signal.aborted ? "Loading this clip took too long. Try again." : "We couldn't load this clip from the video. Try again."
    );
  };

  void (async () => {
    try {
      await Promise.all([readNear(), cutDeep()]);
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
