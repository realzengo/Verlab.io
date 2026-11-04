// Shared "a generation job failed" reporting for video_generations,
// image_generations, and voiceover_generations. Provider errors (missing API
// tokens, moderation rejection codes, upstream 5xxs, ...) are internal detail
// -- meaningless to the person who asked for a video, and a config/infra leak
// if shown verbatim. Every write site for these three tables' error_message
// column should go through here instead of writing a caught error's
// `.message` directly: the generic copy goes in error_message (what the
// generator UIs render), the real detail goes in raw_error_message (selected
// only by admin queries, see admin-queries.ts) and to server logs.
export const GENERIC_GENERATION_ERROR = "Something went wrong. Please try again in a moment.";

// A provider's content filter rejecting the inputs is the one failure the
// user can act on (different footage/photos/wording) and that retrying the
// same request will never fix -- so it gets its own copy instead of the
// generic "try again". Matches Replicate's E005 "flagged as sensitive" and
// the common moderation phrasings other providers return.
const SAFETY_FILTER_PATTERN = /flagged as sensitive|\(E005\)|safety (filter|system|check)|content (policy|moderation)|moderation/i;
export const SAFETY_FILTER_ERROR = "The AI model's safety filter blocked this. Try different footage, photos or wording.";

// The model's ingest refused the file itself (seen live: Kling's
// "VideoNormalize failed, non-square pixels detected"). Uploads are now
// re-encoded in the browser to avoid this, so it should only surface for
// older raw uploads -- and re-uploading is exactly the fix.
const INPUT_FORMAT_PATTERN =
  /VideoNormalize|non-square pixels|pixel aspect ratio|unsupported (video |media )?(codec|format|container)|(could not|failed to|unable to) (decode|read|open|probe) (the )?(input )?(video|media|file)|invalid (video|media) (file|input)/i;
export const INPUT_FORMAT_ERROR = "The model couldn't read this video's format. Upload it again and it'll be converted automatically.";

export function describeGenerationFailure(
  context: string,
  error: unknown
): { error_message: string; raw_error_message: string } {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  console.error(`[${context}]`, error);
  const errorMessage = SAFETY_FILTER_PATTERN.test(raw)
    ? SAFETY_FILTER_ERROR
    : INPUT_FORMAT_PATTERN.test(raw)
      ? INPUT_FORMAT_ERROR
      : GENERIC_GENERATION_ERROR;
  return { error_message: errorMessage, raw_error_message: raw };
}
