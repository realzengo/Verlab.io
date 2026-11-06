// Cloned voices, stored in the private `voice-clones` Storage bucket rather
// than a table: <userId>/<cloneId>.json holds the record and
// <userId>/<cloneId>.mp3 the preview its owner heard when they created it.
//
// Why not the voice_clones table: its migration (20260907120000) was never
// pushed to the production database, and nothing else in this feature needs
// relational queries -- a user has at most MAX_VOICE_CLONES_PER_USER of
// them, always read by owner. One object per clone (not one file per user)
// means two clones finishing at once can't overwrite each other. The bucket
// is created on demand, so the feature works on any environment as-is, and
// every credit charged is still in the credits ledger
// (`voice_clone.<cloneId>`).
//
// Only server code touches this bucket, with the service-role client, and
// always under the signed-in user's own prefix.
import { CLONE_LANGUAGES, type CloneGender, type CloneLanguage, type VoiceCloneSummary } from "@/lib/config/voices";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";

const BUCKET = "voice-clones";
/** Where the browser uploads a sample before cloning (see /api/voice-clones/upload); emptied after each clone attempt. */
export const SAMPLE_BUCKET = "voice-clone-uploads";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Admin = ReturnType<typeof createAdminClient>;

/** Whether the sample was recorded in the form or picked from a file -- kept for the consent audit trail. */
export type CloneSampleSource = "upload" | "recording";

export interface VoiceCloneRecord {
  id: string;
  userId: string;
  name: string;
  /** MiniMax's voice id (from minimax/voice-cloning), sent as speech-2.6-turbo's `voice_id`. Never sent to the client. */
  providerVoiceId: string;
  /** The MiniMax speech model the clone was trained for; generation must use the same one. */
  model: string;
  language: CloneLanguage;
  gender: CloneGender;
  previewText: string;
  noiseReduction: boolean;
  sampleSource: CloneSampleSource;
  /** Read from a WAV sample's header; null for MP3/M4A, which we don't parse. */
  sampleSeconds: number | null;
  hasPreview: boolean;
  consentText: string;
  consentedAt: string;
  creditsCharged: number;
  createdAt: string;
}

export function isCloneId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function recordPath(userId: string, cloneId: string): string {
  return `${userId}/${cloneId}.json`;
}

function previewPath(userId: string, cloneId: string): string {
  return `${userId}/${cloneId}.mp3`;
}

async function ensureCloneBucket(admin: Admin): Promise<void> {
  await ensureBucket(admin, BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/json", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4"],
  });
}

function parseRecord(raw: unknown, userId: string): VoiceCloneRecord | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<VoiceCloneRecord>;
  if (typeof r.id !== "string" || !isCloneId(r.id) || r.userId !== userId) return null;
  if (typeof r.providerVoiceId !== "string" || !r.providerVoiceId || typeof r.name !== "string") return null;
  return {
    id: r.id,
    userId,
    name: r.name,
    providerVoiceId: r.providerVoiceId,
    model: typeof r.model === "string" ? r.model : "speech-02-turbo",
    language: CLONE_LANGUAGES.includes(r.language as CloneLanguage) ? (r.language as CloneLanguage) : "Automatic",
    gender: r.gender === "female" ? "female" : "male",
    previewText: typeof r.previewText === "string" ? r.previewText : "",
    noiseReduction: r.noiseReduction === true,
    sampleSource: r.sampleSource === "recording" ? "recording" : "upload",
    sampleSeconds: typeof r.sampleSeconds === "number" ? r.sampleSeconds : null,
    hasPreview: r.hasPreview === true,
    consentText: typeof r.consentText === "string" ? r.consentText : "",
    consentedAt: typeof r.consentedAt === "string" ? r.consentedAt : "",
    creditsCharged: typeof r.creditsCharged === "number" ? r.creditsCharged : 0,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString(),
  };
}

export function toSummary(record: VoiceCloneRecord): VoiceCloneSummary {
  return {
    id: record.id,
    name: record.name,
    language: record.language,
    gender: record.gender,
    hasPreview: record.hasPreview,
    createdAt: record.createdAt,
  };
}

export async function getClone(userId: string, cloneId: string): Promise<VoiceCloneRecord | null> {
  if (!isCloneId(cloneId)) return null;
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(recordPath(userId, cloneId));
  if (error || !data) return null;
  try {
    return parseRecord(JSON.parse(await data.text()), userId);
  } catch {
    return null;
  }
}

/** Newest first. A missing bucket or folder just means no clones yet. */
export async function listClones(userId: string): Promise<VoiceCloneRecord[]> {
  const { data: entries, error } = await createAdminClient().storage.from(BUCKET).list(userId, { limit: 100 });
  if (error || !entries) return [];
  const ids = entries.map((entry) => entry.name).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length));
  const records = await Promise.all(ids.map((id) => getClone(userId, id)));
  return records.filter((r): r is VoiceCloneRecord => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveClone(record: VoiceCloneRecord): Promise<void> {
  const admin = createAdminClient();
  const upload = () =>
    admin.storage.from(BUCKET).upload(recordPath(record.userId, record.id), JSON.stringify(record), { contentType: "application/json", upsert: true });
  let { error } = await upload();
  if (error && /bucket not found/i.test(error.message)) {
    await ensureCloneBucket(admin);
    ({ error } = await upload());
  }
  if (error) throw new Error(`Saving the voice clone failed: ${error.message}`);
}

export async function saveClonePreview(userId: string, cloneId: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const admin = createAdminClient();
  const upload = () => admin.storage.from(BUCKET).upload(previewPath(userId, cloneId), bytes, { contentType, upsert: true });
  let { error } = await upload();
  if (error && /bucket not found/i.test(error.message)) {
    await ensureCloneBucket(admin);
    ({ error } = await upload());
  }
  if (error) throw new Error(`Saving the clone preview failed: ${error.message}`);
}

export async function signedClonePreviewUrl(userId: string, cloneId: string, ttlSeconds = 300): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(previewPath(userId, cloneId), ttlSeconds);
  return error || !data ? null : data.signedUrl;
}

/**
 * Removes the record and its preview. MiniMax has no endpoint to delete a
 * cloned voice, so the voice itself lingers on their side -- but nothing can
 * reach it once the record (the only place its id lives) is gone.
 */
export async function deleteClone(userId: string, cloneId: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(BUCKET).remove([recordPath(userId, cloneId), previewPath(userId, cloneId)]);
  if (error) throw new Error(`Deleting the voice clone failed: ${error.message}`);
}
