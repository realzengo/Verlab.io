import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
import { parseAnnouncementInput } from "@/lib/announcements";
import {
  ANNOUNCEMENT_SELECT,
  ANNOUNCEMENTS_CACHE_TAG,
  announcementInputToRow,
  isMissingTableError,
  mapAnnouncementRow,
  MISSING_TABLE_MESSAGE,
  type AnnouncementRow,
} from "@/lib/server/announcements";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Edits fields, or turns it on/off with just { isActive }. Keeps the id, so people who closed it don't see it again. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAnnouncementInput(body, { partial: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("announcements")
    .update(announcementInputToRow(parsed.value))
    .eq("id", id)
    .select(ANNOUNCEMENT_SELECT)
    .maybeSingle();

  if (isMissingTableError(error)) {
    return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
  }
  if (error) {
    return serverError("admin/announcements/[id] PATCH", error);
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  revalidateTag(ANNOUNCEMENTS_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ announcement: mapAnnouncementRow(data as AnnouncementRow) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await createAdminClient().from("announcements").delete().eq("id", id);

  if (isMissingTableError(error)) {
    return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
  }
  if (error) {
    return serverError("admin/announcements/[id] DELETE", error);
  }

  revalidateTag(ANNOUNCEMENTS_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true });
}
