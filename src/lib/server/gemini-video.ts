// Client for Gemini Omni Flash's video-editing path -- the Edit tab's
// "Gemini Omni Flash" model (see video-models.ts's EDIT_VIDEO_MODELS).
// Unlike every other video model in this app, this isn't a Replicate
// prediction: it's a direct call to Google's own Gemini API
// (https://ai.google.dev/gemini-api/docs/omni), which is SYNCHRONOUS -- one
// request containing the source video (inline base64) and the edit prompt
// gets back a response with the finished video already embedded (also
// base64), no job id to poll and no webhook. generate-video/edit/route.ts's
// `after()` callback for this provider awaits this function directly rather
// than submitting-and-returning the way the Replicate path does.
//
// Field/endpoint shape confirmed against ai.google.dev/gemini-api/docs/omni
// (fetched live): POST /v1beta/interactions with `model`,
// `input: [{ type: "user_input", content: [{type:"video",...}, {type:"text",...}] }]`,
// `response_format: { type: "video" }`; response is `{ steps: [...], status }`
// with the output video in the step whose `type` is "model_output". Not yet
// exercised against a real API key from this environment -- same "verify
// live before the first real deploy" disclosure every other best-effort
// integration in this codebase carries (see video-models.ts's module
// header).

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_MODEL_ID = "gemini-omni-flash-preview";

// Inline base64 request bodies have a real upper bound on Gemini's API --
// keeping this well under it avoids a large source clip silently 413ing
// instead of failing with a clear message. Edit's own source-duration caps
// (video-models.ts) already keep clips short, so this is a backstop, not
// the primary guard.
const MAX_INLINE_VIDEO_BYTES = 18 * 1024 * 1024;

export class GeminiVideoError extends Error {}

interface GeminiContentPart {
  type: string;
  mime_type?: string;
  data?: string;
  text?: string;
}

interface GeminiStep {
  type: string;
  content?: GeminiContentPart[];
}

interface GeminiInteractionResponse {
  status?: string;
  steps?: GeminiStep[];
  error?: { message?: string };
}

export interface GeminiVideoEditResult {
  bytes: Buffer;
  contentType: string;
}

/**
 * Edits `videoBytes` per `prompt` via Gemini Omni Flash and returns the
 * finished clip's bytes. Throws GeminiVideoError with a real (if terse)
 * message on any non-success response -- callers should route that through
 * describeGenerationFailure() same as every other provider error in this
 * app, rather than surfacing it verbatim.
 */
export async function editVideoWithGemini(input: {
  videoBytes: Uint8Array;
  videoMimeType: string;
  prompt: string;
}): Promise<GeminiVideoEditResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new GeminiVideoError("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }
  if (input.videoBytes.byteLength > MAX_INLINE_VIDEO_BYTES) {
    throw new GeminiVideoError("Source video is too large for Gemini's inline edit API");
  }

  const videoBase64 = Buffer.from(input.videoBytes).toString("base64");

  let response: Response;
  try {
    response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL_ID,
        input: [
          {
            type: "user_input",
            content: [
              { type: "video", mime_type: input.videoMimeType, data: videoBase64 },
              { type: "text", text: input.prompt },
            ],
          },
        ],
        response_format: { type: "video" },
      }),
      // Synchronous generation can genuinely take a couple minutes -- this
      // is the fetch-level backstop, well under the calling route's own
      // maxDuration so a hang here fails cleanly instead of the whole
      // invocation getting killed mid-request.
      signal: AbortSignal.timeout(240_000),
    });
  } catch (error) {
    throw new GeminiVideoError(error instanceof Error ? error.message : "Gemini request failed");
  }

  let payload: GeminiInteractionResponse;
  try {
    payload = await response.json();
  } catch {
    throw new GeminiVideoError(`Gemini returned a non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new GeminiVideoError(payload.error?.message ?? `Gemini request failed (${response.status})`);
  }

  const outputStep = payload.steps?.find((step) => step.type === "model_output");
  const videoPart = outputStep?.content?.find((part) => part.type === "video" && part.data);
  if (!videoPart?.data) {
    throw new GeminiVideoError("Gemini reported success but returned no video output");
  }

  return {
    bytes: Buffer.from(videoPart.data, "base64"),
    contentType: videoPart.mime_type ?? "video/mp4",
  };
}
