import { CLIP_SOURCE_MAX_SECONDS, CLIP_SOURCE_MIN_SECONDS } from "@/lib/clips";

/** Why a video can't be clipped, or null when it can. */
export function clipSourceProblem(durationSeconds: number): string | null {
  if (durationSeconds <= 0) return "Live streams and premieres can be clipped once they've ended.";
  if (durationSeconds < CLIP_SOURCE_MIN_SECONDS) return "That video is already short. Pick one longer than 2 minutes.";
  if (durationSeconds > CLIP_SOURCE_MAX_SECONDS) return "Videos up to 3 hours long work here.";
  return null;
}
