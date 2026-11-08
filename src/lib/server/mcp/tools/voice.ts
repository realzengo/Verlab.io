import "server-only";
import { z } from "zod";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
import { chargeUser } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { getVoiceoverSegmentCost } from "@/lib/config/pricing";
import { estimateDurationSeconds } from "@/lib/server/fal-elevenlabs-tts";
import { CLONE_VOICE_PREFIX, generateSpeechForVoice, isClonedVoiceId, isValidVoiceId } from "@/lib/server/voice-resolution";
import { getClone, listClones, signedClonePreviewUrl } from "@/lib/server/voice-clones";
import { describeGenerationFailure } from "@/lib/server/generation-error";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_VOICE,
  ELEVENLABS_MODELS,
  VOICES,
  getModel,
  isElevenLabsVoiceId,
  parseTtsSettings,
  serializeTtsSettings,
  type ElevenLabsVoice,
} from "@/lib/config/elevenlabs";
import { APP_LINKS, MCP_PUBLIC_ORIGIN, signMediaUrl } from "../links";
import {
  appResult,
  CREATES,
  errorResult,
  formatSeconds,
  POLLING_NOTE,
  READ_ONLY,
  requireCredits,
  runJob,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
} from "./shared";

const VOICEOVER_BUCKET = "voiceovers";
const MAX_VOICEOVER_SCRIPT_CHARS = 5000;
// Generation normally lands in seconds; anything still "generating" after
// this was cut off and will never finish.
const STALE_GENERATING_MS = 10 * 60 * 1000;

// The voices a user hearted in the web voice picker -- a small JSON file per
// user (see /api/voices/saved). Read-only here.
async function readSavedVoices(userId: string): Promise<ElevenLabsVoice[]> {
  const { data, error } = await createAdminClient().storage.from("user-preferences").download(`${userId}/saved-voices.json`);
  if (error || !data) return [];
  try {
    const parsed: unknown = JSON.parse(await data.text());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (voice): voice is ElevenLabsVoice =>
        Boolean(voice) && typeof voice === "object" && typeof voice.voiceId === "string" && isElevenLabsVoiceId(voice.voiceId) && typeof voice.name === "string"
    );
  } catch {
    return [];
  }
}

interface VoiceOption {
  voiceId: string;
  name: string;
  source: "default" | "saved" | "clone";
  description: string;
  meta: string;
  previewUrl: string | null;
}

function voiceMetaLine(voice: Pick<ElevenLabsVoice, "gender" | "accent" | "age">): string {
  return [voice.gender, voice.accent, voice.age].filter(Boolean).join(" · ").toLowerCase();
}

function absolutePreview(url: string | null): string | null {
  if (!url) return null;
  // Bundled previews are static files on our own origin (allowed by the widget CSP).
  return url.startsWith("/") ? `${MCP_PUBLIC_ORIGIN}${url}` : null;
}

async function listVoiceOptions(userId: string): Promise<{ defaults: VoiceOption[]; saved: VoiceOption[]; clones: VoiceOption[] }> {
  const [saved, clones] = await Promise.all([readSavedVoices(userId), listClones(userId)]);
  const cloneOptions = await Promise.all(
    clones.map(async (clone) => ({
      voiceId: `${CLONE_VOICE_PREFIX}${clone.id}`,
      name: clone.name,
      source: "clone" as const,
      description: "Your cloned voice",
      meta: [clone.gender, clone.language === "Automatic" ? null : clone.language].filter(Boolean).join(" · ").toLowerCase(),
      previewUrl: clone.hasPreview ? await signedClonePreviewUrl(userId, clone.id, 60 * 60 * 24).catch(() => null) : null,
    }))
  );
  return {
    defaults: VOICES.map((voice) => ({
      voiceId: voice.voiceId,
      name: voice.name,
      source: "default",
      description: voice.description,
      meta: voiceMetaLine(voice),
      previewUrl: absolutePreview(voice.previewUrl),
    })),
    // Defaults the user hearted already show under Default voices.
    saved: saved.filter((voice) => !VOICES.some((preset) => preset.voiceId === voice.voiceId)).map((voice) => ({
      voiceId: voice.voiceId,
      // Entries saved by pasting a bare id carry the id as their name.
      name: voice.name === voice.voiceId ? "Voice Library voice" : voice.name,
      source: "saved",
      description: voice.description,
      meta: voice.name === voice.voiceId ? voice.voiceId : voiceMetaLine(voice),
      previewUrl: absolutePreview(voice.previewUrl),
    })),
    clones: cloneOptions,
  };
}

const listVoicesTool: McpToolDefinition = {
  name: "list_voices",
  title: "List voiceover voices",
  description:
    "Lists every voice generate_voiceover can use on this account: Verlab's default ElevenLabs voices, voices the user saved from the Voice Library, and " +
    "the user's own cloned voices, with playable previews. Use it when the user wants to pick or hear voices, or asks for 'my voice' / a cloned voice.",
  inputSchema: {},
  annotations: READ_ONLY,
  handler: async (userId) => {
    const { defaults, saved, clones } = await listVoiceOptions(userId);
    const line = (voice: VoiceOption) => `- ${voice.name} (voiceId "${voice.voiceId}")${voice.meta ? ` · ${voice.meta}` : ""}${voice.description ? ` · ${voice.description}` : ""}`;
    const text = [
      clones.length ? `Cloned voices (the user's own):\n${clones.map(line).join("\n")}` : "No cloned voices yet (they can clone one in the Verlab voiceover generator).",
      saved.length ? `Saved Voice Library voices:\n${saved.map(line).join("\n")}` : "",
      `Default voices:\n${defaults.map(line).join("\n")}`,
      "Pass any voiceId (or a voice's name) to generate_voiceover.",
    ]
      .filter(Boolean)
      .join("\n\n");
    return appResult(text, { voices: [...clones, ...saved, ...defaults], appUrl: APP_LINKS.voiceover });
  },
};

type VoiceChoice = { voiceId: string; name: string; isClone: boolean } | { error: string };

async function resolveVoice(userId: string, requested: string): Promise<VoiceChoice> {
  if (!requested) return { voiceId: DEFAULT_VOICE.voiceId, name: DEFAULT_VOICE.name, isClone: false };

  const preset = VOICES.find((v) => v.voiceId === requested || v.name.toLowerCase() === requested.toLowerCase());
  if (preset) return { voiceId: preset.voiceId, name: preset.name, isClone: false };

  if (isClonedVoiceId(requested) || UUID_PATTERN.test(requested)) {
    const voiceId = isClonedVoiceId(requested) ? requested : `${CLONE_VOICE_PREFIX}${requested}`;
    if (!(await isValidVoiceId(voiceId, userId))) return { error: "That cloned voice wasn't found on this account. Call list_voices to see the available voices." };
    const clone = (await listClones(userId)).find((c) => `${CLONE_VOICE_PREFIX}${c.id}` === voiceId);
    return { voiceId, name: clone?.name ?? "Cloned voice", isClone: true };
  }

  if (isElevenLabsVoiceId(requested)) {
    const saved = (await readSavedVoices(userId)).find((v) => v.voiceId === requested);
    return { voiceId: requested, name: saved?.name ?? requested, isClone: false };
  }

  // A plain name: try the user's clones, then their saved voices.
  const wanted = requested.toLowerCase();
  const clone = (await listClones(userId)).find((c) => c.name.toLowerCase() === wanted);
  if (clone) return { voiceId: `${CLONE_VOICE_PREFIX}${clone.id}`, name: clone.name, isClone: true };
  const saved = (await readSavedVoices(userId)).find((v) => v.name.toLowerCase() === wanted);
  if (saved) return { voiceId: saved.voiceId, name: saved.name, isClone: false };

  return {
    error: `There's no voice called "${requested}". Use a default voice name (${VOICES.map((v) => v.name).join(", ")}), one of the user's cloned voices, or a 20-character ElevenLabs voice ID. list_voices shows them all.`,
  };
}

interface VoiceoverSegmentRow {
  index: number;
  text: string;
  audioPath: string;
  durationSeconds: number;
}

function voiceoverPayload(id: string, title: string, voiceName: string, segmentCount: number, durationSeconds: number) {
  return {
    id,
    status: "completed",
    title,
    voiceId: voiceName,
    url: signMediaUrl("voiceover", id, 0),
    downloadUrl: signMediaUrl("voiceover", id, 0, { download: true }),
    parts: Array.from({ length: segmentCount }, (_, i) => signMediaUrl("voiceover", id, i)),
    durationSeconds,
  };
}

const generateVoiceoverTool: McpToolDefinition = {
  name: "generate_voiceover",
  title: "Generate a voiceover",
  description:
    "Turns a script into a natural AI voiceover (ElevenLabs quality) and returns a playable, downloadable audio file. Voices: Verlab's default voices by name, " +
    "the user's cloned voices (by name or clone:<id>), saved Voice Library voices, or any 20-character ElevenLabs voice ID -- list_voices shows them. " +
    `Up to ${MAX_VOICEOVER_SCRIPT_CHARS} characters. Use whenever the user wants spoken narration, not just text. Charges credits only when it succeeds.`,
  inputSchema: {
    script: z.string().describe(`The text to speak, up to ${MAX_VOICEOVER_SCRIPT_CHARS} characters. Plain spoken words only -- no scene directions or headings.`),
    voiceId: z.string().optional().describe(`A voice name, clone:<id>, or ElevenLabs voice ID. Defaults to ${DEFAULT_VOICE.name}.`),
    modelId: z
      .enum(ELEVENLABS_MODELS.map((m) => m.id) as [string, ...string[]])
      .optional()
      .describe(`ElevenLabs model. Defaults to ${DEFAULT_MODEL_ID}. Ignored for cloned voices.`),
    languageCode: z.string().optional().describe("ISO 639-1 code (en, es, fr...). Defaults to en; eleven_multilingual_v2 detects the language itself."),
    stability: z.number().min(0).max(1).optional().describe("0-1. Lower is more expressive, higher more consistent. Default 0.5."),
    similarityBoost: z.number().min(0).max(1).optional().describe("0-1. How closely to match the original voice. Default 0.75."),
    style: z.number().min(0).max(1).optional().describe("0-1 style exaggeration, on models that support it. Default 0."),
    speed: z.number().min(0.7).max(1.2).optional().describe("0.7-1.2 speaking speed. Default 1."),
    title: z.string().optional().describe("A short title, shown in the user's Verlab history."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const script = String(args.script ?? "").trim();
    if (!script) return errorResult("Send the script to read out.", "invalid_input");
    if (script.length > MAX_VOICEOVER_SCRIPT_CHARS) {
      return errorResult(`The script is ${script.length} characters; the limit is ${MAX_VOICEOVER_SCRIPT_CHARS}. Split it into parts.`, "invalid_input");
    }

    const voice = await resolveVoice(userId, typeof args.voiceId === "string" ? args.voiceId.trim() : "");
    if ("error" in voice) return errorResult(voice.error, "invalid_input");

    const settings = parseTtsSettings({
      modelId: typeof args.modelId === "string" ? args.modelId : DEFAULT_MODEL_ID,
      languageCode: args.languageCode,
      voiceSettings: { stability: args.stability, similarityBoost: args.similarityBoost, style: args.style, speed: args.speed },
      voiceName: voice.name,
    });
    if (typeof settings === "string") return errorResult(settings, "invalid_input");
    const model = getModel(settings.modelId)!;
    if (script.length > model.maxChars) {
      return errorResult(`${model.name} reads at most ${model.maxChars} characters at a time. Shorten the script or pick another model.`, "invalid_input");
    }
    const title = String(args.title ?? "").trim().slice(0, 120) || "Untitled Voiceover";

    const cost = getVoiceoverSegmentCost(script.length, model.costMultiplier);
    const lacking = await requireCredits(userId, cost);
    if (lacking) return lacking;

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("voiceover_generations")
      .insert({
        user_id: userId,
        title,
        script,
        voice_id: voice.voiceId,
        generation_mode: "all_at_once",
        style_prompt: serializeTtsSettings(settings),
        language_code: settings.languageCode ?? "auto",
        segments: [],
        credits_quoted: cost,
        status: "generating",
      })
      .select("id")
      .single();
    if (insertError || !row) return errorResult("Couldn't start the voiceover. Please try again.");

    let failureMessage = "The voiceover failed.";
    const outcome = await runJob(
      async () => {
        await ensureBucket(admin, VOICEOVER_BUCKET, {
          public: false,
          fileSizeLimit: 26214400,
          allowedMimeTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"],
        });
        const speech = await generateSpeechForVoice({ text: script, voiceId: voice.voiceId, settings, userId });
        const extension = speech.contentType.includes("wav") ? "wav" : "mp3";
        const audioPath = `${userId}/${row.id}/0.${extension}`;
        const { error: uploadError } = await admin.storage
          .from(VOICEOVER_BUCKET)
          .upload(audioPath, speech.bytes, { contentType: speech.contentType, upsert: true });
        if (uploadError) throw new Error(`Voiceover storage upload failed: ${uploadError.message}`);

        const segment: VoiceoverSegmentRow = {
          index: 0,
          text: script,
          audioPath,
          durationSeconds: estimateDurationSeconds(script, settings.voiceSettings.speed),
        };
        await admin.from("voiceover_generations").update({ segments: [segment], status: "completed" }).eq("id", row.id);
        await chargeUser(userId, cost, "Voiceover Generation", `voiceover.${settings.modelId}`).catch((error) =>
          console.error("[mcp/generate_voiceover] charge failed:", error)
        );
        recordUsageEvent("voiceover", userId, { voiceId: voice.voiceId, generationMode: "all_at_once", source: "mcp" });
        return segment.durationSeconds;
      },
      async (error) => {
        const failure = describeGenerationFailure("mcp/generate_voiceover", error);
        failureMessage = /voice not found/i.test(failure.raw_error_message)
          ? "That voice wasn't found on ElevenLabs. Pick another voice (list_voices)."
          : failure.error_message;
        await admin.from("voiceover_generations").update({ status: "failed", ...failure, error_message: failureMessage }).eq("id", row.id);
      }
    );

    if (outcome.state === "running") {
      return appResult(`Generating the voiceover now (voiceover ${row.id}). ${POLLING_NOTE}`, {
        id: row.id,
        status: "generating",
        title,
        voiceId: voice.name,
      });
    }
    if (outcome.state === "failed") return errorResult(`${failureMessage} Nothing was charged.`);

    const payload = voiceoverPayload(row.id, title, voice.name, 1, outcome.value);
    return appResult(
      `Voiceover "${title}" is ready (${voice.name}, about ${formatSeconds(outcome.value)}), playable in the card above. Download: ${payload.downloadUrl}`,
      payload
    );
  },
};

const checkVoiceoverStatusTool: McpToolDefinition = {
  name: "check_voiceover_status",
  title: "Check voiceover status",
  description: "Checks an in-progress generate_voiceover call by its id. The voiceover card polls this itself.",
  inputSchema: { id: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid voiceover id.", "invalid_input");
    const admin = createAdminClient();
    const { data } = await admin
      .from("voiceover_generations")
      .select("id, status, title, voice_id, segments, error_message, created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return errorResult("That voiceover wasn't found.", "not_found");

    let status = String(data.status);
    let failure = data.error_message as string | null;
    if (status === "generating" && Date.now() - new Date(data.created_at).getTime() > STALE_GENERATING_MS) {
      failure = "Generation timed out. Please try again.";
      await admin.from("voiceover_generations").update({ status: "failed", error_message: failure }).eq("id", id).eq("status", "generating");
      status = "failed";
    }

    const voiceId = String(data.voice_id ?? "");
    const voiceName =
      VOICES.find((v) => v.voiceId === voiceId)?.name ??
      (isClonedVoiceId(voiceId) ? ((await getClone(userId, voiceId.slice(CLONE_VOICE_PREFIX.length)))?.name ?? "Cloned voice") : voiceId);
    if (status === "failed") return errorResult(`${failure ?? "The voiceover failed."} Nothing was charged.`);
    if (status !== "completed") {
      return appResult(`Still generating. ${POLLING_NOTE}`, { id, status: "generating", title: data.title, voiceId: voiceName });
    }

    const segments = Array.isArray(data.segments) ? (data.segments as VoiceoverSegmentRow[]) : [];
    if (!segments.length) return errorResult("The voiceover finished but no audio was saved. Please generate it again.");
    const duration = segments.reduce((sum, segment) => sum + (segment.durationSeconds ?? 0), 0);
    const payload = voiceoverPayload(id, String(data.title ?? "Voiceover"), voiceName, segments.length, duration);
    return appResult(`Voiceover "${payload.title}" is ready (${formatSeconds(duration)}). Download: ${payload.downloadUrl}`, payload);
  },
};

export const VOICE_TOOLS: McpToolDefinition[] = [listVoicesTool, generateVoiceoverTool, checkVoiceoverStatusTool];
