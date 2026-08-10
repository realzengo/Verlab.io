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

export function describeGenerationFailure(
  context: string,
  error: unknown
): { error_message: string; raw_error_message: string } {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  console.error(`[${context}]`, error);
  return { error_message: GENERIC_GENERATION_ERROR, raw_error_message: raw };
}
