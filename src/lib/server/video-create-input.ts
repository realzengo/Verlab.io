import type { VideoModelConfig } from "@/lib/config/video-models";

// Maps the Video Generator's generic Create-tab params onto the body each
// Replicate model expects. Shared by /api/generate-video and the MCP
// generate_video tool so the two can't drift. Field names are best-effort --
// see video-models.ts's module header for which are confirmed vs. inferred.
export function buildReplicateCreateInput(
  model: VideoModelConfig,
  params: {
    prompt?: string;
    aspectRatio: string;
    durationSeconds: number;
    resolution?: string;
    soundEnabled: boolean;
    startFrameImage?: string | null;
    endFrameImage?: string | null;
    referenceImages?: string[];
  }
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    aspect_ratio: model.aspectRatioValues?.[params.aspectRatio] ?? params.aspectRatio,
    duration: params.durationSeconds,
  };
  if (params.prompt) input.prompt = params.prompt;

  if (model.resolutionMode === "direct" && params.resolution) {
    input.resolution = params.resolution;
  } else if (model.resolutionMode === "kling_mode" && params.resolution) {
    input.mode = params.resolution === "1080p" ? "pro" : "standard";
  }

  if (model.supportsAudio) input.generate_audio = params.soundEnabled;

  // Replicate's image-conditioning fields accept a data-URI string directly,
  // no upload step needed (same behavior the pre-migration fal.ai
  // integration relied on for image_urls).
  if (params.startFrameImage) input[model.imageField ?? "image"] = params.startFrameImage;
  if (params.endFrameImage && model.supportsEndFrame) input[model.endFrameField ?? "last_frame_image"] = params.endFrameImage;
  if (params.referenceImages?.length && model.supportsReferenceImages) {
    input[model.referenceImagesField ?? "reference_images"] = params.referenceImages;
  }
  return input;
}
