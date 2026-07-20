import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LibraryAsset, LibraryAssetType, NicheBendCandidate } from "@/lib/types";

// There's no dedicated `user_assets` table -- this unifies the three real
// sources the app already writes to instead of introducing a new table
// nothing else populates. `downloads` is filtered to format='mp4' only:
// it can also hold format='mp3' (audio extractions), but there's no Audio
// tab in the UI yet, so mp3 rows are intentionally left out for now rather
// than mislabeled as video.
const IMAGE_SELECT = "id, prompt, model, images, created_at";
const VIDEO_SELECT = "id, title, source_url, platform, created_at";
const SOP_SELECT = "id, analysis, chosen_bend, created_at";

function estimateBase64Bytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.match(/=+$/)?.[0].length ?? 0;
  return Math.max(0, Math.round((base64.length * 3) / 4 - padding));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "all") as LibraryAssetType | "all";
  const category = searchParams.get("category") ?? "all";
  const sort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

  const wantsImages = type === "all" || type === "image";
  const wantsVideos = type === "all" || type === "video";
  const wantsSops = type === "all" || type === "sop";

  const [imagesResult, videosResult, sopsResult] = await Promise.all([
    wantsImages
      ? supabase.from("image_generations").select(IMAGE_SELECT).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantsVideos
      ? supabase
          .from("downloads")
          .select(VIDEO_SELECT)
          .eq("status", "complete")
          .eq("format", "mp4")
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantsSops
      ? supabase.from("niche_bend_jobs").select(SOP_SELECT).eq("saved", true).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  for (const result of [imagesResult, videosResult, sopsResult]) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
  }

  const assets: LibraryAsset[] = [];

  for (const row of imagesResult.data ?? []) {
    const images: string[] = Array.isArray(row.images) ? row.images : [];
    images.forEach((image, index) => {
      assets.push({
        id: `image-${row.id}-${index}`,
        type: "image",
        title: row.prompt,
        fileUrl: image,
        thumbnailUrl: image,
        sizeBytes: estimateBase64Bytes(image),
        category: row.model,
        createdAt: row.created_at,
      });
    });
  }

  for (const row of videosResult.data ?? []) {
    assets.push({
      id: `video-${row.id}`,
      type: "video",
      title: row.title || row.source_url,
      fileUrl: `/api/downloads/file/${row.id}`,
      thumbnailUrl: null,
      sizeBytes: null,
      category: row.platform,
      createdAt: row.created_at,
    });
  }

  for (const row of sopsResult.data ?? []) {
    const analysis = (row.analysis ?? {}) as { channelName?: string; avatarUrl?: string; detectedNiche?: string };
    const chosenBend = row.chosen_bend as NicheBendCandidate | null;
    assets.push({
      id: `sop-${row.id}`,
      type: "sop",
      title: analysis.channelName || "Saved SOP",
      fileUrl: `/app/library/${row.id}`,
      thumbnailUrl: analysis.avatarUrl ?? null,
      sizeBytes: null,
      category: chosenBend?.nicheName || analysis.detectedNiche || "SOP",
      createdAt: row.created_at,
    });
  }

  const filtered =
    category === "all" ? assets : assets.filter((asset) => asset.category?.toLowerCase() === category.toLowerCase());

  filtered.sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sort === "oldest" ? -diff : diff;
  });

  return NextResponse.json({ assets: filtered });
}
