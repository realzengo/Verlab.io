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
  getAllAnnouncements,
  isMissingTableError,
  mapAnnouncementRow,
  MISSING_TABLE_MESSAGE,
  type AnnouncementRow,
} from "@/lib/server/announcements";

export async function GET(): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { announcements, tableMissing } = await getAllAnnouncements();
  return NextResponse.json({ announcements, tableMissing });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAnnouncementInput(body, { partial: false });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("announcements")
    .insert(announcementInputToRow(parsed.value))
    .select(ANNOUNCEMENT_SELECT)
    .single();

  if (isMissingTableError(error)) {
    return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
  }
  if (error) {
    return serverError("admin/announcements POST", error);
  }

  // Immediate, not stale-while-revalidate: the admin expects the very next
  // app page load to show (or stop showing) it.
  revalidateTag(ANNOUNCEMENTS_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ announcement: mapAnnouncementRow(data as AnnouncementRow) });
}
