// Shared request-body validation for the Video Generator's Create/Edit/Motion
// routes. Split out of generate-video/route.ts because Next's App Router
// only recognizes HTTP-method exports (GET/POST/...) plus a small set of
// route config options from a route.ts file -- anything else risks tripping
// its route-export validation, so shared helpers live in a plain module.

const DATA_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
export const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Validates an optional base64 image data URL field (start/end frame,
 * source images for Edit/Motion). Returns null if the field was omitted,
 * the validated string otherwise. Throws a plain Error with a user-facing
 * message on invalid input -- callers turn that into a 400.
 */
export function validateReferenceImage(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATA_URL_PATTERN.test(value)) {
    throw new Error(`${field} must be a base64 image data URL`);
  }
  const approxBytes = (value.length * 3) / 4;
  if (approxBytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error(`${field} is too large (max 8MB)`);
  }
  return value;
}

/**
 * Array counterpart of validateReferenceImage -- backs the Create tab's
 * "+ References" attachments (style/subject references, distinct from the
 * single start/end frame fields above). Returns an empty array if the field
 * was omitted so callers can treat "no references" and "validated list"
 * uniformly rather than branching on null.
 */
export function validateReferenceImages(value: unknown, field: string, max: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of base64 image data URLs`);
  }
  if (value.length > max) {
    throw new Error(`${field} accepts at most ${max} images`);
  }
  return value.map((item, index) => {
    const validated = validateReferenceImage(item, `${field}[${index}]`);
    if (validated === null) {
      throw new Error(`${field}[${index}] must be a base64 image data URL`);
    }
    return validated;
  });
}
