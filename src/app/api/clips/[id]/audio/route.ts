import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { fetchDownloadLink, humanizeVideoProviderError } from "@/lib/server/video-provider";
import { UPSTREAM_HEADERS } from "@/lib/server/clips/cut-source";
import { Mp3CutError, cutMp3Range } from "@/lib/server/clips/mp3-cut";
import type { ClipProjectRow } from "@/lib/server/clips/projects";
import { CLIP_MAX_SECONDS, TRIM_AFTER_SECONDS } from "@/lib/clips";

// The sound for one clip, from the project's mp3 (see mp3-cut.ts). The
// editor asks for it when a clip's video cut came without (all of) its
// audio, and puts it into the cut in place of the missing track. The mp3 is
// the audio the transcript was made from, so it has the clip's speech even
// when the provider's video merge lost it. Responds with MP3 frames and the
// source time at 0 in them as X-Clip-Offset. The mp3 stream can't seek
// (~9x realtime: about 40 minutes in reach here), so a clip further in races
// it against a trimmed mp3 of just its stretch.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPSTREAM_TIMEOUT_MS = 280_000;
// A saved mp3 link is tried first while it's this young; provider links expire.
const LINK_MAX_AGE_MS = 45 * 60_000;

type AudioLink = { url: string; at: number };

const savedLink = (options: unknown): AudioLink | null => {
  const link = (options as { audioLink?: Partial<AudioLink> } | null)?.audioLink;
  return typeof link?.url === "string" && typeof link.at === "number" ? { url: link.url, at: link.at } : null;
};

/** The mp3's stream: the saved link while it's fresh and answers, else a new one (saved for the next clip). */
async function openAudio(
  row: Pick<ClipProjectRow, "id" | "source_url" | "options">,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const saved = savedLink(row.options);
  if (saved && Date.now() - saved.at < LINK_MAX_AGE_MS) {
    const response = await fetch(saved.url, { headers: UPSTREAM_HEADERS, signal }).catch(() => null);
    if (response?.ok && response.body) return response.body;
    await response?.body?.cancel().catch(() => {});
  }
  const { directUrl } = await fetchDownloadLink(row.source_url, "mp3");
  // Internal, like options.transcribeAttempts: normalizeClipOptions never hands it to the browser.
  await createAdminClient()
    .from("clip_projects")
    .update({ options: { ...((row.options as object | null) ?? {}), audioLink: { url: directUrl, at: Date.now() } } })
    .eq("id", row.id);
  const response = await fetch(directUrl, { headers: UPSTREAM_HEADERS, signal });
  if (!response.ok || !response.body) throw new Error(`Audio stream returned ${response.status}`);
  return response.body;
}

type Mp3Cut = Awaited<ReturnType<typeof cutMp3Range>>;

/** The clip's sound from a trimmed mp3 of its stretch (the provider cuts it; a finished file). */
async function cutFromTrim(
  row: Pick<ClipProjectRow, "source_url" | "duration_seconds">,
  from: number,
  to: number,
  signal: AbortSignal
): Promise<Mp3Cut> {
  const start = Math.max(0, Math.floor(from) - 1);
  const end = Math.min(Math.floor(row.duration_seconds), Math.ceil(to) + 2);
  const { directUrl } = await fetchDownloadLink(row.source_url, "mp3", undefined, {
    range: { start, end },
    signal,
    stallMs: 45_000,
    timeoutMs: 240_000,
  });
  const response = await fetch(directUrl, { headers: UPSTREAM_HEADERS, signal });
  if (!response.ok || !response.body) throw new Error(`Trimmed audio returned ${response.status}`);
  const cut = await cutMp3Range(response.body, from - start, to - start);
  return { ...cut, offset: cut.offset + start };
}

/** Whichever gets the clip's sound first: the mp3 stream from 0:00, or (deep clips) a trimmed mp3. */
async function cutClipAudio(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds" | "options">,
  from: number,
  to: number,
  signal: AbortSignal
): Promise<Mp3Cut> {
  if (from < TRIM_AFTER_SECONDS) return cutMp3Range(await openAudio(row, signal), from, to);
  const viaStream = new AbortController();
  const viaTrim = new AbortController();
  const stopBoth = () => {
    viaStream.abort();
    viaTrim.abort();
  };
  signal.addEventListener("abort", stopBoth, { once: true });
  try {
    return await Promise.any([
      openAudio(row, viaStream.signal)
        .then((stream) => cutMp3Range(stream, from, to))
        .then((cut) => (viaTrim.abort(), cut)),
      cutFromTrim(row, from, to, viaTrim.signal).then((cut) => (viaStream.abort(), cut)),
    ]);
  } catch (error) {
    throw error instanceof AggregateError ? error.errors[0] : error;
  } finally {
    signal.removeEventListener("abort", stopBoth);
  }
}

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
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

  if (!(await checkRateLimit(`clips-audio:${user.id}`, 20, 60))) {
    return rateLimitedResponse();
  }

  const { data: row } = await supabase
    .from("clip_projects")
    .select("id, source_url, duration_seconds, status, options")
    .eq("id", id)
    .maybeSingle<Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds" | "status" | "options">>();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "ready") {
    return NextResponse.json({ error: "This project isn't ready yet" }, { status: 409 });
  }

  const from = Number(request.nextUrl.searchParams.get("from"));
  const to = Number(request.nextUrl.searchParams.get("to"));
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from < 0 ||
    to <= from ||
    to > row.duration_seconds + 1 ||
    to - from > CLIP_MAX_SECONDS + 20
  ) {
    return NextResponse.json({ error: "Invalid clip range" }, { status: 400 });
  }

  const upstream = new AbortController();
  const timeout = setTimeout(() => upstream.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const cut = await cutClipAudio(row, from, to, upstream.signal);
    // Streamed (not one buffered body) so a long clip at a high bitrate stays clear of response size caps.
    return new Response(new Blob(cut.frames as BlobPart[]).stream(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
        "X-Clip-Offset": String(cut.offset),
      },
    });
  } catch (error) {
    console.error(`[clips/audio] ${row.id} ${from}-${to}:`, upstream.signal.aborted ? "out of time" : error);
    const message =
      error instanceof Mp3CutError
        ? "This clip's sound couldn't be found."
        : upstream.signal.aborted
          ? "Reading the sound took too long. Try again."
          : humanizeVideoProviderError(error);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
    upstream.abort();
  }
}

export const GET = withApiLogging("/api/clips/[id]/audio", handleGET);
