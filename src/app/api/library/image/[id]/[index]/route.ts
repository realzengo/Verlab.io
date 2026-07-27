import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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
  const contentType = dataUrl.slice(5, commaIndex).split(";")[0] || "image/jpeg";
  const buffer = Buffer.from(dataUrl.slice(commaIndex + 1), "base64");

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
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
