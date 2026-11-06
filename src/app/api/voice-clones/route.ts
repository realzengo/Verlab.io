import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getVoiceCloneCost } from "@/lib/config/pricing";
import {
  CLONE_CONSENT_TEXT,
  CLONE_LANGUAGES,
  CLONE_PREVIEW_TEXT_MAX,
  CLONE_SAMPLE_MAX_BYTES,
  CLONE_SAMPLE_MAX_SECONDS,
  CLONE_SAMPLE_MIN_SECONDS,
  MAX_VOICE_CLONES_PER_USER,
  VOICE_CLONING_ENABLED,
  type CloneLanguage,
} from "@/lib/config/voices";
import { chargeUser, getUserCredits } from "@/lib/server/credits";
import { createVoiceClone, ReplicateVoiceCloneError } from "@/lib/server/replicate-voice-clone";
import { generateSpeechForClonedVoice } from "@/lib/server/replicate-voice-clone-tts";
import { listClones, saveClone, saveClonePreview, SAMPLE_BUCKET, toSummary, type CloneSampleSource, type VoiceCloneRecord } from "@/lib/server/voice-clones";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSafeFreeText, isValidName } from "@/lib/validation";

// Cloned voices: GET lists the caller's, POST creates one from a sample the
// browser already uploaded via /api/voice-clones/upload.
//
// POST, in order: validate the form (consent included), check the clone
// limit and the balance, confirm the uploaded bytes really are MP3/WAV/M4A
// (and, for a WAV -- every in-form recording is one -- that its length is
// within MiniMax's limits), clone with MiniMax, render the owner's preview text once in the new voice
// (stored, so every later play is a static file -- and a first real use of
// the voice on MiniMax's side), save the record, and only then charge. A
// failure anywhere before the charge costs the user nothing. The sample is
// deleted in every case; we never keep a voice recording.
export const maxDuration = 180;

const MIN_SAMPLE_BYTES = 8 * 1024;
const SAMPLE_URL_TTL_SECONDS = 10 * 60;
// Enough for the container's magic number and, for a WAV, the fmt and data
// chunk headers that give its length.
const HEADER_SNIFF_BYTES = 4096;

type SampleKind = "mp3" | "wav" | "m4a";

// Container magic numbers. The bucket's MIME allow-list only checks the
// type the browser *declared*, so the bytes themselves are checked here.
function sniffSample(header: Uint8Array): SampleKind | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...header.subarray(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(4, 8) === "ftyp") return "m4a";
  if (ascii(0, 3) === "ID3") return "mp3";
  if (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) return "mp3"; // MPEG audio frame sync
  return null;
}

// A WAV's length is in its header: the fmt chunk's byte rate and the data
// chunk's size. Null when the header isn't one we can read, in which case
// MiniMax still enforces the limits itself.
function wavDurationSeconds(header: Uint8Array, totalBytes: number): number | null {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const chunkId = (start: number) => String.fromCharCode(...header.subarray(start, start + 4));
  let byteRate = 0;
  for (let offset = 12; offset + 8 <= header.length; ) {
    const id = chunkId(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 20 <= header.length) byteRate = view.getUint32(offset + 16, true);
    if (id === "data") {
      if (!byteRate) return null;
      const available = Number.isFinite(totalBytes) ? totalBytes - (offset + 8) : size;
      // Streamed WAVs leave the size at 0 or 0xFFFFFFFF; the file's own length is right then.
      const dataBytes = size > 0 && size !== 0xffffffff ? Math.min(size, available) : available;
      return dataBytes > 0 ? dataBytes / byteRate : null;
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

interface CreateCloneBody {
  name?: unknown;
  uploadPath?: unknown;
  source?: unknown;
  language?: unknown;
  gender?: unknown;
  previewText?: unknown;
  noiseReduction?: unknown;
  consent?: unknown;
}

function badRequest(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}

async function handleGET(): Promise<NextResponse> {
  if (!VOICE_CLONING_ENABLED) return NextResponse.json({ voiceClones: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const clones = await listClones(user.id);
  return NextResponse.json({ voiceClones: clones.map(toSummary) });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  if (!VOICE_CLONING_ENABLED) return badRequest("Voice cloning is temporarily unavailable. Check back soon.", 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return badRequest("Not authenticated", 401);

  if (!(await checkRateLimit(`voice-clones:${user.id}`, 5, 300))) return rateLimitedResponse();

  let body: CreateCloneBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || !isValidName(name)) return badRequest("Give your voice a name (letters, numbers and simple punctuation).");

  const uploadPath = typeof body.uploadPath === "string" ? body.uploadPath : "";
  const uploadMatch = new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(mp3|m4a|wav)$`).exec(uploadPath);
  if (!uploadMatch) return badRequest("Upload an audio sample first.");
  const declaredKind = uploadMatch[1] as SampleKind;

  // From here on the sample is the caller's own -- it's deleted however
  // this request ends, so a rejected form never leaves a recording behind.
  const admin = createAdminClient();
  const removeSample = async () => {
    const { error } = await admin.storage.from(SAMPLE_BUCKET).remove([uploadPath]);
    if (error) console.error("[voice-clones] Failed to remove the uploaded sample (non-fatal):", error);
  };

  try {
    const language = CLONE_LANGUAGES.includes(body.language as CloneLanguage) ? (body.language as CloneLanguage) : null;
    if (!language) return badRequest("Pick a language for this voice.");
    if (body.gender !== "male" && body.gender !== "female") return badRequest("Pick a gender for this voice.");
    const gender = body.gender;

    const previewText = typeof body.previewText === "string" ? body.previewText.trim() : "";
    if (!previewText) return badRequest("Add a line of preview text.");
    if (!isSafeFreeText(previewText, CLONE_PREVIEW_TEXT_MAX)) return badRequest(`Preview text must be plain text, at most ${CLONE_PREVIEW_TEXT_MAX} characters.`);

    if (body.consent !== true) return badRequest("Confirm you own this voice or have permission to clone it.");
    const noiseReduction = body.noiseReduction !== false;

    const existing = await listClones(user.id);
    if (existing.length >= MAX_VOICE_CLONES_PER_USER) {
      return badRequest(`You can have up to ${MAX_VOICE_CLONES_PER_USER} cloned voices. Delete one to add another.`);
    }

    const cost = getVoiceCloneCost();
    if ((await getUserCredits(user.id)) < cost) return badRequest("Insufficient credits", 402);

    // One short-lived URL serves both the header check and MiniMax's
    // download -- its path ends in the real extension, which MiniMax needs.
    const { data: signed, error: signError } = await admin.storage.from(SAMPLE_BUCKET).createSignedUrl(uploadPath, SAMPLE_URL_TTL_SECONDS);
    if (signError || !signed) return badRequest("We couldn't find your uploaded sample. Please upload it again.");

    const head = await fetch(signed.signedUrl, { headers: { Range: `bytes=0-${HEADER_SNIFF_BYTES - 1}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!head?.ok) return badRequest("We couldn't find your uploaded sample. Please upload it again.");
    const totalBytes = Number(head.headers.get("content-range")?.split("/")[1] ?? head.headers.get("content-length"));
    const header = new Uint8Array(await head.arrayBuffer());
    const kind = sniffSample(header);
    if (!kind) return badRequest("That file isn't a WAV, MP3, or M4A audio file.");
    if (kind !== declaredKind) return badRequest("That file's contents don't match its type. Try exporting it again as WAV, MP3, or M4A.");
    if (Number.isFinite(totalBytes) && totalBytes > CLONE_SAMPLE_MAX_BYTES) return badRequest("Your sample must be under 20MB.");
    if (Number.isFinite(totalBytes) && totalBytes < MIN_SAMPLE_BYTES) return badRequest("Your sample must be at least 10 seconds long.");

    const sampleSeconds = kind === "wav" ? wavDurationSeconds(header, totalBytes) : null;
    if (sampleSeconds !== null && sampleSeconds < CLONE_SAMPLE_MIN_SECONDS) {
      return badRequest(`Your sample is ${Math.floor(sampleSeconds)} seconds long. It needs at least ${CLONE_SAMPLE_MIN_SECONDS}.`);
    }
    if (sampleSeconds !== null && sampleSeconds > CLONE_SAMPLE_MAX_SECONDS + 1) return badRequest("Your sample must be under 5 minutes long.");

    // Declared by the client, so trusted only as far as it can be checked:
    // the form's recorder always produces a WAV.
    const sampleSource: CloneSampleSource = body.source === "recording" && kind === "wav" ? "recording" : "upload";

    let clone: { voiceId: string; model: string };
    try {
      clone = await createVoiceClone(signed.signedUrl, { noiseReduction });
    } catch (error) {
      console.error("[voice-clones] Clone failed:", error);
      const message = error instanceof ReplicateVoiceCloneError && error.userMessage ? error.userMessage : "We couldn't clone that voice. Please try again in a moment.";
      return badRequest(message, error instanceof ReplicateVoiceCloneError && error.userMessage ? 422 : 502);
    }

    const id = randomUUID();
    let hasPreview = false;
    try {
      const speech = await generateSpeechForClonedVoice(clone.voiceId, previewText, { model: clone.model, language });
      await saveClonePreview(user.id, id, speech.bytes, speech.contentType.startsWith("audio/") ? speech.contentType : "audio/mpeg");
      hasPreview = true;
    } catch (error) {
      // The voice itself exists and works -- a missing preview just means the
      // Cloned tab shows no play button for it.
      console.error("[voice-clones] Preview render failed (clone kept):", error);
    }

    const now = new Date().toISOString();
    const record: VoiceCloneRecord = {
      id,
      userId: user.id,
      name,
      providerVoiceId: clone.voiceId,
      model: clone.model,
      language,
      gender,
      previewText,
      noiseReduction,
      sampleSource,
      sampleSeconds: sampleSeconds === null ? null : Math.round(sampleSeconds * 10) / 10,
      hasPreview,
      consentText: CLONE_CONSENT_TEXT,
      consentedAt: now,
      creditsCharged: cost,
      createdAt: now,
    };
    try {
      await saveClone(record);
    } catch (error) {
      console.error("[voice-clones] Saving the record failed:", error);
      return badRequest("We couldn't save your cloned voice. You haven't been charged, so please try again.", 500);
    }

    try {
      await chargeUser(user.id, cost, "Voice Cloning", `voice_clone.${id}`);
    } catch (creditError) {
      // The voice is created and saved -- a ledger failure shouldn't undo
      // that, same posture as generate-voiceover/route.ts.
      console.error("[credits] Failed to deduct for voice clone:", creditError);
    }

    return NextResponse.json({ voiceClone: toSummary(record) });
  } finally {
    await removeSample();
  }
}

export const GET = withApiLogging("/api/voice-clones", handleGET);
export const POST = withApiLogging("/api/voice-clones", handlePOST);
