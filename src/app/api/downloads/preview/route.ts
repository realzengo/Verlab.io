import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchVideoPreview, humanizeVideoProviderError } from "@/lib/server/video-provider";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url")?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const preview = await fetchVideoPreview(url);
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json({ error: humanizeVideoProviderError(error) }, { status: 422 });
  }
}
