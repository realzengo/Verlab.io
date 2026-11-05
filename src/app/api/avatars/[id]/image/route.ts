import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { USER_AVATAR_BUCKET, isUuid } from "@/lib/server/user-avatars";

// Same reasoning as /api/library/image/[id]/[index]: this needs the session
// cookie, which next/image's optimizer wouldn't forward, so the picker's
// thumbnails (`?w=`) are resized here instead.
const MAX_THUMBNAIL_WIDTH = 1024;

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: row } = await supabase
    .from("user_avatars")
    .select("image_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: file, error } = await createAdminClient().storage.from(USER_AVATAR_BUCKET).download(row.image_path);
  if (error || !file) {
    return serverError("avatars/[id]/image GET", error, "Could not load that avatar.");
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  let contentType = "image/jpeg";

  const requestedWidth = Number(request.nextUrl.searchParams.get("w"));
  if (Number.isFinite(requestedWidth) && requestedWidth > 0) {
    try {
      buffer = Buffer.from(
        await sharp(buffer)
          .resize({ width: Math.min(Math.round(requestedWidth), MAX_THUMBNAIL_WIDTH), withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer()
      );
      contentType = "image/webp";
    } catch {
      // Serve the stored JPEG untouched rather than failing the request.
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      // An avatar's image never changes after it's saved (a new image is a new id).
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export const GET = withApiLogging("/api/avatars/[id]/image", handleGET);
