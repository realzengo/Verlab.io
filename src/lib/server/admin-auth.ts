import { createClient as createServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/server/admin";

/**
 * Re-checks the caller is an authenticated admin. Returns the user's email
 * on success, or null if the request should be rejected (caller decides the
 * status code — 401 vs 403 — since that differs per route). Node-runtime
 * only (uses next/headers) — for API routes, not src/proxy.ts.
 */
export async function getAdminEmailOrNull(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isAdminEmail(user.email)) return null;
  return user.email;
}
