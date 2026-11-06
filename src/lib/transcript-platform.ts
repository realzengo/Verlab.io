import type { TranscriptRow } from "@/lib/types";

export type TranscriptPlatform = TranscriptRow["platform"];

// Shared by the extract API (server) and the Transcripts page (client), so
// the field's platform hint always agrees with what the server will accept.
export function detectTranscriptPlatform(rawUrl: string): TranscriptPlatform | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/tiktok\.com/i.test(trimmed)) return "tiktok";
  if (/instagram\.com\/(reel|p)\//i.test(trimmed)) return "reels";
  // "shorts" is a legacy label (kept as-is since it's a Postgres check-
  // constraint value on the transcripts table) — it now covers every
  // youtube.com/watch?v=... and youtu.be link too, not just /shorts/.
  if (/youtube\.com\/(shorts\/|watch)|youtu\.be/i.test(trimmed)) return "shorts";
  return null;
}
