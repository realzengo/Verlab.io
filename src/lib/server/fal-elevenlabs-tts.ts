// ElevenLabs text-to-speech via fal.ai's ElevenLabs endpoints (see
// src/lib/config/elevenlabs.ts for the models and why fal, not Replicate).
// fal.run is fal's synchronous endpoint -- the request blocks until the audio
// is ready, which a short script chunk is within seconds, so there's no
// separate submit/poll queue machinery.
import "server-only";
import { getModel, type ElevenLabsModel, type TtsSettings } from "@/lib/config/elevenlabs";

export class ElevenLabsTtsError extends Error {
  /** fal answered "Voice not found" -- the voice id isn't a usable ElevenLabs voice. */
  readonly voiceNotFound: boolean;

  constructor(message: string, voiceNotFound = false) {
    super(message);
    this.name = "ElevenLabsTtsError";
    this.voiceNotFound = voiceNotFound;
  }
}

export interface GenerateSpeechInput {
  text: string;
  voiceId: string;
  settings: TtsSettings;
  /** Neighbouring segment text, for prosody continuity in line-by-line mode. */
  previousText?: string;
  nextText?: string;
}

export interface GeneratedSpeech {
  bytes: Uint8Array;
  contentType: string;
}

const REQUEST_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

// Only the fields this endpoint's schema has (see the model's capability flags).
function buildInput(model: ElevenLabsModel, input: GenerateSpeechInput): Record<string, unknown> {
  const { settings } = input;
  const vs = settings.voiceSettings;
  const body: Record<string, unknown> = { text: input.text, voice: input.voiceId, stability: vs.stability };
  if (model.similarity) body.similarity_boost = vs.similarityBoost;
  if (model.style) body.style = vs.style;
  if (model.speed) body.speed = vs.speed;
  if (model.languageSelection && settings.languageCode) body.language_code = settings.languageCode;
  if (model.requestStitching) {
    if (input.previousText) body.previous_text = input.previousText;
    if (input.nextText) body.next_text = input.nextText;
  }
  return body;
}

// fal validation errors look like {"detail":[{"msg":"Voice not found: x", ...}]};
// other failures use a plain string `detail`.
function readFalError(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((d) => (d as { msg?: unknown })?.msg).filter((m): m is string => typeof m === "string");
    if (messages.length) return messages.join("; ");
  }
  return `fal request failed (${status})`;
}

async function callFal(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const key = process.env.FAL_API_KEY;
  if (!key) throw new ElevenLabsTtsError("FAL_API_KEY is not configured");

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(`https://fal.run/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ElevenLabsTtsError(`fal took too long to respond (timed out after ${REQUEST_TIMEOUT_MS / 1000}s)`);
      }
      throw new ElevenLabsTtsError(error instanceof Error ? error.message : "fal request failed");
    }

    const payload = await response.json().catch(() => null);
    if (response.ok) return payload;
    if (attempt === 0 && RETRYABLE_STATUSES.has(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    const message = readFalError(payload, response.status);
    throw new ElevenLabsTtsError(message, /voice not found/i.test(message));
  }
}

export async function generateSpeech(input: GenerateSpeechInput): Promise<GeneratedSpeech> {
  if (!input.text.trim()) throw new ElevenLabsTtsError("text is required");
  const model = getModel(input.settings.modelId);
  if (!model) throw new ElevenLabsTtsError(`Unknown model ${input.settings.modelId}`);

  const output = (await callFal(model.falEndpoint, buildInput(model, input))) as { audio?: { url?: unknown; content_type?: unknown } } | null;
  const url = output?.audio?.url;
  if (typeof url !== "string") throw new ElevenLabsTtsError("fal returned no audio");

  const audio = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!audio.ok) throw new ElevenLabsTtsError(`Downloading fal audio failed (${audio.status})`);
  const contentType = audio.headers.get("content-type") ?? (typeof output?.audio?.content_type === "string" ? output.audio.content_type : "");
  return { bytes: new Uint8Array(await audio.arrayBuffer()), contentType: contentType.startsWith("audio/") ? contentType : "audio/mpeg" };
}

// ~150 words/minute -- a placeholder until the client reads the real audio
// duration (VoiceoverGenerator.tsx corrects it on loadedmetadata).
export function estimateDurationSeconds(text: string, speed = 1): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.5, wordCount / ((150 / 60) * speed));
}
