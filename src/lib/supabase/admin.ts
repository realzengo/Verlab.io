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
