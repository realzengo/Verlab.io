import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { generateImages, IMAGE_MODEL_MAP } from "@/lib/server/cloudflare-image";
import { recordUsageEvent } from "@/lib/server/usage";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, prompt, model, aspect_ratio, outputs, images, created_at")
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

  let images: string[];
  try {
    images = await generateImages({
      prompt,
      model,
      aspectRatio,
      outputs: outputs!,
      quality: quality as "auto" | "low" | "medium" | "high",
      resolution: resolution as "512px" | "1K" | "2K" | "4K",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate images";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  after(async () => {
    recordUsageEvent("image", user.id, { model, aspectRatio, outputs });
    await supabase.from("image_generations").insert({
      user_id: user.id,
      prompt,
      model,
      aspect_ratio: aspectRatio,
      outputs,
      images,
    });
  });

  return NextResponse.json({ images });
}
