import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { getVoiceOption, VOICE_OPTIONS } from "@/lib/config/voices";
import { getLanguageOption } from "@/lib/config/languages";
import { getVoiceoverSegmentCost } from "@/lib/config/pricing";
import { chargeUser, getUserCredits } from "@/lib/server/credits";
import { generateSpeech, estimateDurationSeconds, ReplicateTtsError } from "@/lib/server/replicate-tts";
import { splitScript } from "@/lib/server/voiceover-segmentation";
import { mapWithConcurrency } from "@/lib/server/concurrency";
import { recordUsageEvent } from "@/lib/server/usage";
import { withApiLogging } from "@/lib/server/api-logging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";

export const maxDuration = 300;

const STORAGE_BUCKET = "voiceovers";
const MAX_SCRIPT_CHARS = 5000;
const MAX_SEGMENTS = 60;
const SEGMENT_CONCURRENCY = 4;
// Well under Replicate's 4,000-byte `prompt` limit -- a style instruction
// has no business being longer than this in practice.
const MAX_STYLE_PROMPT_CHARS = 500;

// Same rationale as generate-image/route.ts's STALE_GENERATING_MS -- nothing
// guarantees the after() background job below gets to run to completion (a
// redeploy, an uncaught crash, or maxDuration itself all skip its catch
// block), so any row still "generating" well past a plausible finish time
// gets swept to "failed" on the next GET.
const STALE_GENERATING_MS = 6 * 60 * 1000;

export interface VoiceoverSegment {
  index: number;
  text: string;
  audioPath: string;
  durationSeconds: number;
}

interface GenerateVoiceoverRequestBody {
  title?: string;
  script?: string;
  voiceId?: string;
  stylePrompt?: string;
  languageCode?: string;
  generationMode?: "line_by_line" | "all_at_once";
}

async function sweepStaleRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { id: string; status: string; error_message: string | null; created_at: string }[]
): Promise<void> {
  const staleIds = rows
    .filter((row) => row.status === "generating" && Date.now() - new Date(row.created_at).getTime() > STALE_GENERATING_MS)
    .map((row) => row.id);

  if (staleIds.length === 0) return;

  const timeoutMessage = "Generation timed out. Please try again.";
  await supabase.from("voiceover_generations").update({ status: "failed", error_message: timeoutMessage }).in("id", staleIds);
  for (const row of rows) {
    if (staleIds.includes(row.id)) {
      row.status = "failed";
      row.error_message = timeoutMessage;
    }
  }
}

// Byte-light for the list view -- `segments` holds Storage paths, not audio
// bytes, so it's small unlike image_generations.images (base64 data URLs),
// but there's still no reason to ship it for rows the sidebar just lists.
const LIST_SELECT = "id, title, voice_id, generation_mode, style_prompt, language_code, status, error_message, credits_quoted, created_at";
const DETAIL_SELECT = `${LIST_SELECT}, script, segments`;
// History tab needs a script preview (for search-result context) plus a
// segment count/duration to render each row without shipping full segment
// objects (audioPath strings, per-segment text) -- those are stripped back
// out in the response transform below.
const HISTORY_SELECT = `${LIST_SELECT}, script, segments`;
const HISTORY_LIMIT_DEFAULT = 100;
const HISTORY_LIMIT_MAX = 200;
const SCRIPT_PREVIEW_CHARS = 240;

// PostgREST's `.or()` filter string treats `,` and `)` as syntax, not data --
// strip them so a search query can't inject extra filter clauses.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

interface HistoryListRow {
  id: string;
  title: string;
  voice_id: string;
  generation_mode: string;
  language_code: string;
  status: string;
  error_message: string | null;
  credits_quoted: number;
  created_at: string;
  script: string;
  segments: unknown;
}

function toHistoryListItem(row: HistoryListRow) {
  const segments: { durationSeconds?: number }[] = Array.isArray(row.segments) ? row.segments : [];
  return {
    id: row.id,
    title: row.title,
    voiceId: row.voice_id,
    generationMode: row.generation_mode,
    languageCode: row.language_code,
    status: row.status,
    errorMessage: row.error_message,
    creditsQuoted: row.credits_quoted,
    createdAt: row.created_at,
    scriptPreview: row.script.slice(0, SCRIPT_PREVIEW_CHARS),
    segmentCount: segments.length,
    durationSeconds: segments.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0),
  };
}

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const id = params.get("id");

  if (id) {
    const { data, error } = await supabase.from("voiceover_generations").select(DETAIL_SELECT).eq("id", id).maybeSingle();
    if (error) {
      console.error("[generate-voiceover] Failed to load generation:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ generations: [] });

    await sweepStaleRows(supabase, [data]);
    return NextResponse.json({ generations: [data] });
  }

  // History tab: search + filters. Every param is optional -- with none
  // supplied this degrades to the same "last N generations" listing the
  // sidebar used before the History tab existed.
  const q = params.get("q");
  const voiceId = params.get("voiceId");
  const mode = params.get("mode");
  const status = params.get("status");
  const from = params.get("from");
  const to = params.get("to");
  const limit = Math.min(HISTORY_LIMIT_MAX, Math.max(1, Number(params.get("limit")) || HISTORY_LIMIT_DEFAULT));

  let query = supabase.from("voiceover_generations").select(HISTORY_SELECT).order("created_at", { ascending: false }).limit(limit);

  if (q && sanitizeSearchTerm(q)) {
    const term = sanitizeSearchTerm(q);
    query = query.or(`title.ilike.%${term}%,script.ilike.%${term}%`);
  }
  if (voiceId) query = query.eq("voice_id", voiceId);
  if (mode === "line_by_line" || mode === "all_at_once") query = query.eq("generation_mode", mode);
  if (status === "completed" || status === "failed" || status === "generating") query = query.eq("status", status);
  if (from && !Number.isNaN(Date.parse(from))) query = query.gte("created_at", from);
  if (to && !Number.isNaN(Date.parse(to))) query = query.lte("created_at", to);

  const { data, error } = await query;

  if (error) {
    console.error("[generate-voiceover] Failed to load history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sweepStaleRows(supabase, data);
  return NextResponse.json({ generations: (data as HistoryListRow[]).map(toHistoryListItem) });
}

async function handleDELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("voiceover_generations")
    .select("id, segments")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("voiceover_generations").delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const segments: VoiceoverSegment[] = Array.isArray(row.segments) ? row.segments : [];
  if (segments.length > 0) {
    const admin = createAdminClient();
    const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(segments.map((s) => s.audioPath));
    // The row is already deleted -- orphaned Storage objects are cleaned up
    // later, not a reason to report the delete as failed (same posture as
    // the per-segment DELETE in [id]/segments/[index]/route.ts).
    if (storageError) console.error("[generate-voiceover] Failed to remove storage objects (non-fatal):", storageError);
  }

  return NextResponse.json({ ok: true });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: GenerateVoiceoverRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, script, voiceId, stylePrompt, languageCode, generationMode } = body;

  if (!script || !script.trim()) {
    return NextResponse.json({ error: "script is required" }, { status: 400 });
  }
  if (script.length > MAX_SCRIPT_CHARS) {
    return NextResponse.json({ error: `script must be ${MAX_SCRIPT_CHARS} characters or fewer` }, { status: 400 });
  }

  const voice = voiceId ? getVoiceOption(voiceId) : undefined;
  if (!voice) {
    return NextResponse.json({ error: `voiceId must be one of: ${VOICE_OPTIONS.map((v) => v.id).join(", ")}` }, { status: 400 });
  }

  if (!stylePrompt || !stylePrompt.trim()) {
    return NextResponse.json({ error: "stylePrompt is required" }, { status: 400 });
  }
  if (stylePrompt.length > MAX_STYLE_PROMPT_CHARS) {
    return NextResponse.json({ error: `stylePrompt must be ${MAX_STYLE_PROMPT_CHARS} characters or fewer` }, { status: 400 });
  }
  if (!languageCode || !getLanguageOption(languageCode)) {
    return NextResponse.json({ error: "languageCode must be a supported language" }, { status: 400 });
  }
  if (generationMode !== "line_by_line" && generationMode !== "all_at_once") {
    return NextResponse.json({ error: "generationMode must be 'line_by_line' or 'all_at_once'" }, { status: 400 });
  }

  const segmentTexts = splitScript(script, generationMode);
  if (segmentTexts.length === 0) {
    return NextResponse.json({ error: "Could not find any speakable text in that script" }, { status: 400 });
  }
  if (segmentTexts.length > MAX_SEGMENTS) {
    return NextResponse.json({ error: `Script splits into too many segments (max ${MAX_SEGMENTS}) -- try "All at Once" or a shorter script` }, { status: 400 });
  }

  const cost = segmentTexts.reduce((sum, text) => sum + getVoiceoverSegmentCost(text.length), 0);

  // Checked synchronously, same rationale as generate-image/route.ts: the
  // response below is sent before generation finishes, so a balance check
  // made later (inside after()) would have no way to tell the client "insufficient credits" with a 402.
  const balance = await getUserCredits(user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const { data: row, error: insertError } = await supabase
    .from("voiceover_generations")
    .insert({
      user_id: user.id,
      title: title?.trim() || "Untitled Script",
      script,
      voice_id: voice.id,
      generation_mode: generationMode,
      style_prompt: stylePrompt,
      language_code: languageCode,
      segments: [],
      credits_quoted: cost,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[generate-voiceover] Insert failed:", insertError);
    return NextResponse.json({ error: insertError?.message ?? "Could not start generation" }, { status: 500 });
  }

  after(async () => {
    const admin = createAdminClient();
    try {
      // The `voiceovers` bucket may not exist yet if the migration that
      // creates it hasn't been pushed to this environment's database --
      // create it on demand (Storage API only, no direct DB connection
      // needed) before the segment loop below tries to upload into it.
      await ensureBucket(admin, STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: 26214400,
        allowedMimeTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"],
      });

      const segments: VoiceoverSegment[] = await mapWithConcurrency(segmentTexts, SEGMENT_CONCURRENCY, async (text, index) => {
        const speech = await generateSpeech({ text, voiceId: voice.id, stylePrompt, languageCode });
        const extension = speech.contentType.includes("wav") ? "wav" : "mp3";
        const audioPath = `${user.id}/${row.id}/${index}.${extension}`;

        const { error: uploadError } = await admin.storage
          .from(STORAGE_BUCKET)
          .upload(audioPath, speech.bytes, { contentType: speech.contentType, upsert: true });
        if (uploadError) throw new Error(`Voiceover storage upload failed: ${uploadError.message}`);

        return { index, text, audioPath, durationSeconds: estimateDurationSeconds(text) };
      });

      try {
        await chargeUser(user.id, cost, "Voiceover Generation", `voiceover.${voice.id}`);
      } catch (creditError) {
        // Audio is already generated and stored -- a ledger failure here
        // shouldn't undo that, same posture as generate-image/route.ts.
        console.error("[credits] Failed to deduct for voiceover generation:", creditError);
      }

      await admin.from("voiceover_generations").update({ segments, status: "completed" }).eq("id", row.id);
      void recordUsageEvent("voiceover", user.id, { voiceId: voice.id, generationMode, segments: segments.length });
    } catch (error) {
      const message = error instanceof ReplicateTtsError || error instanceof Error ? error.message : "Could not generate voiceover";
      await admin.from("voiceover_generations").update({ status: "failed", error_message: message }).eq("id", row.id);
    }
  });

  return NextResponse.json({ id: row.id });
}

export const GET = withApiLogging("/api/generate-voiceover", handleGET);
export const POST = withApiLogging("/api/generate-voiceover", handlePOST);
export const DELETE = withApiLogging("/api/generate-voiceover", handleDELETE);
