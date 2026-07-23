import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { generateImages, IMAGE_MODEL_MAP } from "@/lib/server/cloudflare-image";
import { deductCredits, getUserCredits } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { createClient } from "@/lib/supabase/server";

const IMAGE_GENERATION_COST = 1;

export const maxDuration = 300;

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];
const QUALITIES = ["auto", "low", "medium", "high"];
const RESOLUTIONS = ["512px", "1K", "2K", "4K"];

interface GenerateImageRequestBody {
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  outputs?: number;
  quality?: string;
  resolution?: string;
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("image_generations")
    .select("id, prompt, model, aspect_ratio, outputs, images, status, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generations: data });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: GenerateImageRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, model, aspectRatio, outputs, quality = "auto", resolution = "1K" } = body;

  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  if (!model || !(model in IMAGE_MODEL_MAP)) {
    return NextResponse.json({ error: "model must be one of the supported options" }, { status: 400 });
  }

  if (!aspectRatio || !ASPECT_RATIOS.includes(aspectRatio)) {
    return NextResponse.json({ error: "aspectRatio must be one of the supported options" }, { status: 400 });
  }

  if (!Number.isInteger(outputs) || outputs! < 1 || outputs! > 4) {
    return NextResponse.json({ error: "outputs must be an integer between 1 and 4" }, { status: 400 });
  }

  if (!QUALITIES.includes(quality)) {
    return NextResponse.json({ error: "quality must be one of the supported options" }, { status: 400 });
  }

  if (!RESOLUTIONS.includes(resolution)) {
    return NextResponse.json({ error: "resolution must be one of the supported options" }, { status: 400 });
  }

  // Checked synchronously (not inside the after() callback below) because
  // the response for this request is sent before generation finishes — by
  // the time we'd know the balance was too low in the background, there'd
  // be no way left to tell the client with a 403.
  const balance = await getUserCredits(user.id);
  if (balance < IMAGE_GENERATION_COST) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
  }

  // Generation can take minutes (Nano Banana Pro / flux-2-dev especially --
  // see cloudflare-image.ts). Holding the HTTP response open that long is
  // unreliable: a proxy, gateway, or the browser itself can kill an idle
  // connection well before generation finishes, which used to make the UI's
  // pending tile vanish while the server kept working in the background and
  // wrote the result to the DB minutes later with no way for the client to
  // find out. Instead, insert a `generating` row and respond immediately;
  // the client polls GET for this row's status the same way niche-bend jobs
  // are polled (see niche-bend-job-store.ts).
  const { data: row, error: insertError } = await supabase
    .from("image_generations")
    .insert({
      user_id: user.id,
      prompt,
      model,
      aspect_ratio: aspectRatio,
      outputs,
      images: [],
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return NextResponse.json({ error: insertError?.message ?? "Could not start generation" }, { status: 500 });
  }

  // `after()` (not a bare fire-and-forget call) keeps the serverless
  // invocation alive until generation settles, instead of Vercel freezing it
  // the instant the response above is flushed.
  after(async () => {
    try {
      const images = await generateImages({
        prompt,
        model,
        aspectRatio,
        outputs: outputs!,
        quality: quality as "auto" | "low" | "medium" | "high",
        resolution: resolution as "512px" | "1K" | "2K" | "4K",
      });
      recordUsageEvent("image", user.id, { model, aspectRatio, outputs });
      try {
        await deductCredits(user.id, IMAGE_GENERATION_COST, "Image Generation");
      } catch (creditError) {
        // The image was already generated (Cloudflare already spent) — a
        // ledger failure here shouldn't undo that or fail the request.
        console.error("[credits] Failed to deduct for image generation:", creditError);
      }
      await supabase.from("image_generations").update({ images, status: "completed" }).eq("id", row.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate images";
      await supabase.from("image_generations").update({ status: "failed", error_message: message }).eq("id", row.id);
    }
  });

  return NextResponse.json({ id: row.id });
}
