import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClipAspect, ClipExport } from "@/lib/clips";

// Finished clips live in the private `clip-exports` bucket at
// <user_id>/<project_id>/<export_id>.mp4, served back through signed URLs.

export const CLIP_EXPORTS_BUCKET = "clip-exports";
const SIGNED_URL_SECONDS = 60 * 60;

export interface ClipExportRow {
  id: string;
  project_id: string;
  clip_id: string;
  title: string;
  storage_path: string;
  aspect: ClipAspect;
  duration_seconds: number;
  size_bytes: number;
  created_at: string;
}

export const CLIP_EXPORT_COLUMNS =
  "id, project_id, clip_id, title, storage_path, aspect, duration_seconds, size_bytes, created_at";

const downloadName = (title: string) =>
  `${
    title
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "clip"
  }.mp4`;

/** Rows whose file is really in Storage, with a playable URL and a download URL. */
export async function withClipExportUrls(rows: ClipExportRow[]): Promise<ClipExport[]> {
  if (!rows.length) return [];
  const storage = createAdminClient().storage.from(CLIP_EXPORTS_BUCKET);
  const { data } = await storage.createSignedUrls(
    rows.map((row) => row.storage_path),
    SIGNED_URL_SECONDS
  );
  const urls = new Map((data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  const present = rows.filter((row) => urls.get(row.storage_path));
  // Signed with a download name, so the browser saves "<title>.mp4" instead of opening it.
  const downloads = await Promise.all(
    present.map((row) =>
      storage.createSignedUrl(row.storage_path, SIGNED_URL_SECONDS, { download: downloadName(row.title) })
    )
  );
  return present.map((row, index) => ({
    id: row.id,
    projectId: row.project_id,
    clipId: row.clip_id,
    title: row.title,
    aspect: row.aspect,
    durationSeconds: Number(row.duration_seconds),
    sizeBytes: Number(row.size_bytes),
    url: urls.get(row.storage_path)!,
    downloadUrl: downloads[index].data?.signedUrl ?? urls.get(row.storage_path)!,
    createdAt: row.created_at,
  }));
}
