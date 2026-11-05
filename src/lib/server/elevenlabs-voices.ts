// ElevenLabs voices beyond the bundled defaults in src/lib/config/elevenlabs.ts:
// the public Voice Library (thousands of community voices) and lookups of a
// single voice id. Speech for all of them is generated through fal (see
// fal-elevenlabs-tts.ts) -- ElevenLabs' own API is only used here, for
// browsing and metadata, so no TTS is ever billed on the ElevenLabs account.
//
// Searching or filtering the library needs a signed-in ElevenLabs account
// (an anonymous GET /v1/shared-voices returns only the 3 newest voices and
// rejects `search`/`gender` with "You must be logged in to use filters"), so
// it needs ELEVENLABS_API_KEY -- any account works, a free one included.
// Without it the picker still offers the defaults and pasting a voice id.
import "server-only";
import type { ElevenLabsVoice } from "@/lib/config/elevenlabs";

const API_BASE = "https://api.elevenlabs.io/v1";
const REQUEST_TIMEOUT_MS = 15_000;
export const LIBRARY_PAGE_SIZE = 30;

export function isVoiceLibraryConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Labels come as snake_case ("middle_aged").
function humanize(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? capitalize(value.trim().replace(/_/g, " ")) : null;
}

interface RawVoice {
  voice_id?: unknown;
  name?: unknown;
  preview_url?: unknown;
  gender?: unknown;
  accent?: unknown;
  age?: unknown;
  labels?: Record<string, unknown>;
}

// Library names usually carry a tagline ("Rocco - Energetic & Charming");
// it's split off into `description` so the picker can show the name alone
// where space is tight. Voices without one keep an empty description.
function toVoice(raw: RawVoice): ElevenLabsVoice | null {
  if (typeof raw.voice_id !== "string" || typeof raw.name !== "string") return null;
  const labels = raw.labels ?? {};
  const [name, ...tagline] = raw.name.split(/\s+[-–]\s+/);
  const gender = raw.gender ?? labels.gender;
  const age = humanize(raw.age ?? labels.age);
  return {
    voiceId: raw.voice_id,
    name: name.trim() || raw.name,
    gender: gender === "male" || gender === "female" ? gender : null,
    accent: humanize(raw.accent ?? labels.accent),
    age: age ? age.toLowerCase() : null,
    description: tagline.join(" - ").trim(),
    previewUrl: typeof raw.preview_url === "string" ? raw.preview_url : null,
  };
}

async function elevenLabsGet(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export interface VoiceLibraryPage {
  voices: ElevenLabsVoice[];
  hasMore: boolean;
}

export async function searchVoiceLibrary(options: { search: string; gender: "male" | "female" | null; page: number }): Promise<VoiceLibraryPage> {
  const params = new URLSearchParams({ page_size: String(LIBRARY_PAGE_SIZE), page: String(options.page), sort: "trending" });
  if (options.search) params.set("search", options.search);
  if (options.gender) params.set("gender", options.gender);

  const response = await elevenLabsGet(`/shared-voices?${params}`);
  if (!response.ok) throw new Error(`ElevenLabs voice library request failed (${response.status})`);
  const data = (await response.json()) as { voices?: RawVoice[]; has_more?: unknown };
  return {
    voices: (data.voices ?? []).map(toVoice).filter((v): v is ElevenLabsVoice => v !== null),
    hasMore: data.has_more === true,
  };
}

/**
 * Name, labels and sample clip for one voice id, or null if ElevenLabs won't
 * say (no API key, or an id it doesn't know). GET /v1/voices/{id} answers
 * for public Voice Library voices too (its documented example is a shared
 * voice with `is_owner: false`); a library search for the exact id is the
 * fallback.
 */
export async function fetchVoiceMetadata(voiceId: string): Promise<ElevenLabsVoice | null> {
  if (!isVoiceLibraryConfigured()) return null;
  try {
    const response = await elevenLabsGet(`/voices/${encodeURIComponent(voiceId)}`);
    if (response.ok) {
      const voice = toVoice((await response.json()) as RawVoice);
      if (voice?.voiceId === voiceId) return voice;
    }
  } catch {
    // fall through to the library search
  }
  try {
    const params = new URLSearchParams({ search: voiceId, page_size: "10" });
    const response = await elevenLabsGet(`/shared-voices?${params}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { voices?: RawVoice[] };
    const match = (data.voices ?? []).find((v) => v.voice_id === voiceId);
    return match ? toVoice(match) : null;
  } catch {
    return null;
  }
}
