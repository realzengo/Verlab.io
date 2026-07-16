/**
 * Comma-separated allowlist of emails permitted into /admin and /api/admin/*.
 * Single source of truth — imported by both src/proxy.ts (page-level gate,
 * which may run on the Edge runtime) and every admin API route (defense in
 * depth, since routes should never rely solely on the page-level gate having
 * already run). Deliberately dependency-free so it's safe in either runtime.
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
