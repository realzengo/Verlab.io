import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";

// Thumbnail requests (a `w` query param, from the Library grid/preview) get
// resized and re-encoded here rather than served at full resolution. This
// route requires a Supabase session, so it can't go through next/image's
// built-in optimizer -- that dispatches an internal request that doesn't
// forward cookies, which 401s and renders as a broken image. Resizing
// server-side and serving straight from this route (which the browser hits
// directly, cookies included) sidesteps that entirely.
const MAX_THUMBNAIL_WIDTH = 1600;

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
): Promise<NextResponse> {
  const { id, index } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("image_generations")
    .select("images")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const images: string[] = Array.isArray(data?.images) ? data.images : [];
  const dataUrl = images[Number(index)];
  if (!dataUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const commaIndex = dataUrl.indexOf(",");
  let contentType = dataUrl.slice(5, commaIndex).split(";")[0] || "image/jpeg";
  let buffer = Buffer.from(dataUrl.slice(commaIndex + 1), "base64");

  const isDownload = request.nextUrl.searchParams.get("download") === "1";
  const requestedWidth = Number(request.nextUrl.searchParams.get("w"));

  if (!isDownload && Number.isFinite(requestedWidth) && requestedWidth > 0) {
    try {
      const resized = await sharp(buffer)
        .rotate()
        .resize({ width: Math.min(requestedWidth, MAX_THUMBNAIL_WIDTH), withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      buffer = Buffer.from(resized);
      contentType = "image/webp";
    } catch {
      // Source sharp can't decode (unsupported format, corrupt data, etc) --
      // fall back to serving the original bytes untouched.
    }
  }

  const disposition = isDownload ? "attachment" : "inline";
  const extension = contentType.split("/")[1] ?? "jpg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="image-${id}-${index}.${extension}"`,
      // Generated images are immutable once written -- safe to cache hard.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
): Promise<NextResponse> {
  const { id, index } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("image_generations")
    .select("images")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const images: string[] = Array.isArray(data?.images) ? data.images : [];
  const targetIndex = Number(index);
  if (!images[targetIndex]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const remaining = images.filter((_, i) => i !== targetIndex);

  // A row with no images left behind is just dead weight -- remove it
  // outright instead of leaving an empty `image_generations` record.
  const { error } =
    remaining.length === 0
      ? await supabase.from("image_generations").delete().eq("id", id).eq("user_id", user.id)
      : await supabase
          .from("image_generations")
          .update({ images: remaining, outputs: remaining.length })
          .eq("id", id)
          .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const GET = withApiLogging("/api/library/image/[id]/[index]", handleGET);
export const DELETE = withApiLogging("/api/library/image/[id]/[index]", handleDELETE);
