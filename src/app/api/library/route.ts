import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import type { LibraryAsset, LibraryAssetType, NicheBendCandidate } from "@/lib/types";

// There's no dedicated `user_assets` table -- this unifies the real
// sources the app already writes to instead of introducing a new table
// nothing else populates. Videos come from `video_generations` (not the
// `downloads` table -- ingested/downloaded videos are a separate concern).
//
// `image_generations.images` holds raw base64 data URLs (up to 4K res,
// multi-MB each as text) with no separate thumbnail column yet. Selecting
// that column here for up to 40 rows produced multi-tens-of-MB JSON
// responses -- slow to transfer/parse client-side, and large enough to hit
// serverless response-size limits outright (the "Couldn't load your
// library" error). `outputs` already records how many images each row has,
// so the list can stay byte-light; actual image bytes are served lazily,
// one at a time, from /api/library/image/[id]/[index].
const IMAGE_SELECT = "id, prompt, model, outputs, created_at";
// Same byte-light approach: no raw video bytes here, just the path columns
// /api/library/video/[id] needs to mint signed playback/thumbnail URLs.
const VIDEO_SELECT = "id, prompt, model, output_video_path, thumbnail_path, created_at";
const SOP_SELECT = "id, analysis, chosen_bend, created_at";
const VOICEOVER_SELECT = "id, title, voice_id, created_at";

async function handleGET(request: NextRequest): Promise<NextResponse> {
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
  const wantsVoiceovers = type === "all" || type === "voiceover";

  // Capped well below the old 100 to bound how many lazy image requests
  // one Library page load can fan out into.
  const [imagesResult, videosResult, sopsResult, voiceoversResult] = await Promise.all([
    wantsImages
      ? supabase
          .from("image_generations")
          .select(IMAGE_SELECT)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantsVideos
      ? supabase
          .from("video_generations")
          .select(VIDEO_SELECT)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantsSops
      ? supabase.from("niche_bend_jobs").select(SOP_SELECT).eq("saved", true).order("created_at", { ascending: false }).limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantsVoiceovers
      ? supabase
          .from("voiceover_generations")
          .select(VOICEOVER_SELECT)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  for (const result of [imagesResult, videosResult, sopsResult, voiceoversResult]) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
  }

  const assets: LibraryAsset[] = [];

  for (const row of imagesResult.data ?? []) {
    for (let index = 0; index < row.outputs; index++) {
      // Actual image bytes are fetched lazily by the client, one per asset,
      // from this URL -- the list response never carries image data itself.
      assets.push({
        id: `image-${row.id}-${index}`,
        type: "image",
        title: row.prompt,
        fileUrl: null,
        thumbnailUrl: `/api/library/image/${row.id}/${index}`,
        sizeBytes: null,
        category: row.model,
        createdAt: row.created_at,
      });
    }
  }

  for (const row of videosResult.data ?? []) {
    // Playback bytes are served lazily too, same reason as images: videos
    // live in a private Storage bucket, so /api/library/video/[id] mints a
    // short-lived signed URL per request instead of one being in this row.
    assets.push({
      id: `video-${row.id}`,
      type: "video",
      title: row.prompt || "Generated video",
      fileUrl: `/api/library/video/${row.id}`,
      thumbnailUrl: row.thumbnail_path ? `/api/library/video/${row.id}?variant=thumbnail` : null,
      sizeBytes: null,
      category: row.model,
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

  for (const row of voiceoversResult.data ?? []) {
    // No single audio file lives on the row -- segments are stitched
    // client-side (see VoiceoverGenerator's exportSegmentsAsWav) -- so this
    // opens the generator with the generation preloaded instead of pointing
    // at playable bytes, same posture as SOPs' fileUrl above.
    assets.push({
      id: `voiceover-${row.id}`,
      type: "voiceover",
      title: row.title || "Untitled Script",
      fileUrl: `/app/voiceover-generator?id=${row.id}`,
      thumbnailUrl: null,
      sizeBytes: null,
      category: row.voice_id,
      createdAt: row.created_at,
    });
  }

  const filtered =
    category === "all" ? assets : assets.filter((asset) => asset.category?.toLowerCase() === category.toLowerCase());

  filtered.sort((a, b) => {
    // Voiceovers have no visual thumbnail, so mixed in with images/videos/SOPs
    // they break the grid's visual rhythm -- pin them to the end of the "all"
    // view regardless of sort direction. Within the voiceover-only tab (and
    // within the trailing voiceover group here) the chosen sort still applies.
    if (type === "all" && a.type !== b.type && (a.type === "voiceover" || b.type === "voiceover")) {
      return a.type === "voiceover" ? 1 : -1;
    }
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sort === "oldest" ? -diff : diff;
  });

  return NextResponse.json({ assets: filtered });
}

export const GET = withApiLogging("/api/library", handleGET);
