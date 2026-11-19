import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAnnouncementExpired,
  type AdminAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from "@/lib/announcements";

export const ANNOUNCEMENTS_CACHE_TAG = "announcements";

/** PostgREST / Postgres codes for "no such table": the migration hasn't been applied. */
export function isMissingTableError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export const MISSING_TABLE_MESSAGE =
  "The announcements table doesn't exist yet. Apply supabase/migrations/20261119140000_announcements.sql, then try again.";

export const ANNOUNCEMENT_SELECT = "id, kind, message, cta_label, cta_href, expires_at, is_active, created_at, updated_at";

// Enough that closing the newest still leaves the next ones to show, and that
// a few stale-but-active rows can't crowd out a live one.
const LIVE_LIMIT = 20;

export interface AnnouncementRow {
  id: string;
  kind: string;
  message: string;
  cta_label: string | null;
  cta_href: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function mapAnnouncementRow(row: AnnouncementRow): AdminAnnouncement {
  return {
    id: row.id,
    kind: row.kind === "promo" ? "promo" : "update",
    message: row.message,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function announcementInputToRow(input: Partial<AnnouncementInput>): Partial<AnnouncementRow> {
  const row: Partial<AnnouncementRow> = {};
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.message !== undefined) row.message = input.message;
  if (input.ctaLabel !== undefined) row.cta_label = input.ctaLabel;
  if (input.ctaHref !== undefined) row.cta_href = input.ctaHref;
  if (input.expiresAt !== undefined) row.expires_at = input.expiresAt;
  if (input.isActive !== undefined) row.is_active = input.isActive;
  return row;
}

/**
 * Active rows, newest first, through Next's shared Data Cache: every /app
 * page load reads this, so it shouldn't cost a database round trip each time.
 * Admin writes call revalidateTag so changes show at once; the 60s revalidate
 * covers edits made straight in the Supabase table editor. Expiry is checked
 * by the caller at read time, not here, so a cached row still disappears the
 * moment it ends.
 */
const getActiveAnnouncementRows = unstable_cache(
  async (): Promise<Announcement[]> => {
    const { data, error } = await createAdminClient()
      .from("announcements")
      .select(ANNOUNCEMENT_SELECT)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(LIVE_LIMIT);

    // A banner is never worth failing a page for. Caching the empty result
    // for the revalidate window also keeps an outage (or a missing table)
    // from adding a failed query to every page load.
    if (error) {
      console.error("[announcements] load failed:", error.message);
      return [];
    }

    return (data as AnnouncementRow[]).map((row) => {
      const { id, kind, message, ctaLabel, ctaHref, expiresAt } = mapAnnouncementRow(row);
      return { id, kind, message, ctaLabel, ctaHref, expiresAt };
    });
  },
  ["announcements-active"],
  { tags: [ANNOUNCEMENTS_CACHE_TAG], revalidate: 60 }
);

/** What the app shows, newest first. Never throws. */
export async function getLiveAnnouncements(): Promise<Announcement[]> {
  try {
    const rows = await getActiveAnnouncementRows();
    const now = Date.now();
    return rows.filter((row) => !isAnnouncementExpired(row, now));
  } catch (error) {
    console.error("[announcements] cache read failed:", error);
    return [];
  }
}

/** Every row, for the admin page. Uncached. `tableMissing` drives a setup notice there. */
export async function getAllAnnouncements(): Promise<{ announcements: AdminAnnouncement[]; tableMissing: boolean }> {
  const { data, error } = await createAdminClient()
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[announcements] admin load failed:", error.message);
    return { announcements: [], tableMissing: isMissingTableError(error) };
  }
  return { announcements: (data as AnnouncementRow[]).map(mapAnnouncementRow), tableMissing: false };
}
