import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Only import this from
 * server-only code (API routes, cron handlers); never from a Client
 * Component or anything that ends up in the browser bundle.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface EnsureBucketOptions {
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
}

/**
 * Creates a Storage bucket on demand if it doesn't exist yet. Bucket
 * creation only needs the Storage HTTP API (same network path every other
 * admin.storage.* call already uses successfully) -- unlike `supabase db
 * push`, it doesn't need a direct Postgres connection, so it isn't blocked
 * by environments that can't reach the db pooler (e.g. no IPv6 route).
 *
 * This intentionally does NOT create the storage.objects RLS policies that
 * normally ship alongside a bucket in a migration -- every call site that
 * uses this reads/writes via the service-role client or signed URLs it
 * mints after checking row ownership in application code, so those
 * policies are defense-in-depth, not load-bearing (see
 * supabase/migrations/20260806192425_voiceover_buckets.sql). Run the real
 * migration when the DB is reachable to get them for defense-in-depth.
 */
export async function ensureBucket(admin: SupabaseClient, id: string, options: EnsureBucketOptions): Promise<void> {
  const { data: existing } = await admin.storage.getBucket(id);
  if (existing) return;

  const { error } = await admin.storage.createBucket(id, {
    public: options.public,
    fileSizeLimit: options.fileSizeLimit,
    allowedMimeTypes: options.allowedMimeTypes,
  });
  // Ignore a race where another concurrent request created it first.
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

/**
 * Recursively removes every Storage object under `${userId}/` in one bucket.
 * Every per-user bucket in this app (videos, voiceovers, and -- once
 * something actually writes to it -- avatars) keys its objects at
 * `${userId}/...` per that bucket's own migration comment, so this one
 * two-level list-then-remove covers all of them.
 *
 * Exists because account deletion (`DELETE /api/account`) removes the
 * `auth.users` row, and `on delete cascade` FKs (e.g. video_generations.user_id,
 * voiceover_generations.user_id) clean up the DB rows that pointed at these
 * objects -- but Storage objects aren't rows in those tables, so nothing
 * about that cascade ever reaches them. Without this, every video/voiceover
 * a deleted user ever generated survives in Storage forever with no DB row
 * left to ever reference or clean it up.
 *
 * Best-effort by design, same posture as every other Storage cleanup call
 * site in this codebase (see e.g. /api/library/video/[id]'s DELETE): a
 * listing/removal failure is logged, not thrown, so it can never block the
 * account deletion itself.
 */
export async function removeUserStorageObjects(admin: SupabaseClient, bucket: string, userId: string): Promise<void> {
  try {
    const { data: topLevel, error: listError } = await admin.storage.from(bucket).list(userId);
    if (listError || !topLevel || topLevel.length === 0) return;

    const paths: string[] = [];
    for (const entry of topLevel) {
      // Supabase Storage's list() convention: a real file has `id` set, a
      // folder entry (one level of nesting, e.g. `<generationId>/`) has
      // `id: null`. Objects here live at `${userId}/${generationId}/<file>`,
      // so folder entries need one more list() to reach the actual files.
      if (entry.id) {
        paths.push(`${userId}/${entry.name}`);
        continue;
      }
      const { data: nested } = await admin.storage.from(bucket).list(`${userId}/${entry.name}`);
      for (const file of nested ?? []) {
        paths.push(`${userId}/${entry.name}/${file.name}`);
      }
    }

    if (paths.length === 0) return;

    // Chunked so one user with a very large library can't blow past
    // Storage's per-request remove() limits.
    const CHUNK_SIZE = 100;
    for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths.slice(i, i + CHUNK_SIZE));
      if (removeError) console.error(`[removeUserStorageObjects] Failed to remove objects from "${bucket}":`, removeError);
    }
  } catch (error) {
    console.error(`[removeUserStorageObjects] Unexpected failure cleaning up "${bucket}":`, error);
  }
}
