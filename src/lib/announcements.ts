// The announcement bar's shared pieces: types, limits and input checks, used
// by the app banner, the admin page and the admin API alike. Storage and
// caching live in lib/server/announcements.ts.

export type AnnouncementKind = "update" | "promo";

export const ANNOUNCEMENT_KINDS: readonly AnnouncementKind[] = ["update", "promo"];

// Mirrored by the check constraints in the announcements migration.
export const ANNOUNCEMENT_MESSAGE_MAX = 200;
export const ANNOUNCEMENT_CTA_LABEL_MAX = 32;
export const ANNOUNCEMENT_CTA_HREF_MAX = 500;

/** Button text when a link is set without any. */
export const DEFAULT_CTA_LABEL = "Learn more";

/** What the app gets: an active row that hasn't expired. */
export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  expiresAt: string | null;
}

export interface AdminAnnouncement extends Announcement {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isAnnouncementExpired(announcement: Pick<Announcement, "expiresAt">, now = Date.now()): boolean {
  return announcement.expiresAt != null && Date.parse(announcement.expiresAt) <= now;
}

/**
 * A same-site path ("/clipping") or an absolute http(s) URL; anything else
 * (javascript:, data:, protocol-relative "//host") comes back null so it's
 * never rendered as a link.
 */
export function safeCtaHref(href: string | null | undefined): string | null {
  const value = href?.trim();
  if (!value || value.length > ANNOUNCEMENT_CTA_HREF_MAX) return null;
  if (/^\/(?![/\\])/.test(value)) return value;
  // Same shape as the table's check constraint: scheme, then "//", then a host.
  if (!isExternalHref(value)) return null;
  try {
    return new URL(value).host ? value : null;
  } catch {
    return null;
  }
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export interface AnnouncementInput {
  kind: AnnouncementKind;
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** "" and null clear the field; undefined means the value wasn't a string. */
function optionalText(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  return value.trim() || null;
}

/**
 * Validates an admin create (`partial: false`, message required) or update
 * (`partial: true`, only the keys present are checked and returned).
 */
export function parseAnnouncementInput(raw: unknown, { partial }: { partial: boolean }): Parsed<Partial<AnnouncementInput>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Invalid JSON body");
  const body = raw as Record<string, unknown>;
  const has = (key: string) => key in body;
  const out: Partial<AnnouncementInput> = {};

  if (has("kind") || !partial) {
    const kind = body.kind ?? "update";
    if (!ANNOUNCEMENT_KINDS.includes(kind as AnnouncementKind)) return fail("kind must be 'update' or 'promo'");
    out.kind = kind as AnnouncementKind;
  }

  if (has("message") || !partial) {
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return fail("Message is required");
    if (message.length > ANNOUNCEMENT_MESSAGE_MAX) return fail(`Message must be ${ANNOUNCEMENT_MESSAGE_MAX} characters or fewer`);
    out.message = message;
  }

  if (has("ctaLabel")) {
    const label = optionalText(body.ctaLabel);
    if (label === undefined) return fail("ctaLabel must be a string");
    if (label && label.length > ANNOUNCEMENT_CTA_LABEL_MAX) return fail(`Button text must be ${ANNOUNCEMENT_CTA_LABEL_MAX} characters or fewer`);
    out.ctaLabel = label;
  }

  if (has("ctaHref")) {
    const href = optionalText(body.ctaHref);
    if (href === undefined) return fail("ctaHref must be a string");
    if (href && !safeCtaHref(href)) return fail("Link must be a path in the app like /clipping, or a full https:// URL");
    out.ctaHref = href;
  }

  if (out.ctaLabel && has("ctaHref") && !out.ctaHref) return fail("Add a link for the button, or clear its text");

  if (has("expiresAt")) {
    const expiresAt = optionalText(body.expiresAt);
    if (expiresAt === undefined) return fail("expiresAt must be a string");
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return fail("expiresAt must be a valid date");
    out.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
  }

  if (has("isActive")) {
    if (typeof body.isActive !== "boolean") return fail("isActive must be true or false");
    out.isActive = body.isActive;
  }

  if (partial && Object.keys(out).length === 0) return fail("Nothing to update");
  return { ok: true, value: out };
}
