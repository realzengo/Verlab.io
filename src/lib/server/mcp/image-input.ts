import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSignedMediaUrl } from "./links";

// Image inputs for MCP tools (a start frame for generate_video, reference
// images for generate_image/generate_video). Claude can't attach the user's
// chat uploads to a tool call, so an image arrives as one of:
//   - "image:<generation id>:<index>", the ref every generate_image result prints
//   - one of our own signed media links (what the image widget shows)
//   - any public https image URL
//   - a base64 data URL
// Everything is normalized to a validated data URL, which is what the web
// routes already hand to the providers.

export const MAX_INPUT_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);
const IMAGE_REF_PATTERN = /^image:([0-9a-f-]{36}):(\d{1,2})$/i;
const DATA_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

export class ImageInputError extends Error {}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new ImageInputError("Image links must start with https://");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((entry) => entry.address);
  if (addresses.length === 0) throw new ImageInputError(`Couldn't reach ${url.hostname}`);
  if (addresses.some(isPrivateAddress)) throw new ImageInputError("That image link points at a private address");
}

async function readCapped(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_INPUT_IMAGE_BYTES) throw new ImageInputError("That image is larger than 8MB");
  const reader = response.body?.getReader();
  if (!reader) throw new ImageInputError("That image link returned nothing");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_INPUT_IMAGE_BYTES) {
      await reader.cancel();
      throw new ImageInputError("That image is larger than 8MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchPublicImage(raw: string): Promise<Buffer> {
  let url = new URL(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { Accept: "image/*" } });
    } catch {
      throw new ImageInputError(`Couldn't download the image from ${url.hostname}`);
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new ImageInputError(`The image link returned HTTP ${response.status}`);
    return readCapped(response);
  }
  throw new ImageInputError("That image link redirected too many times");
}

async function toValidatedDataUrl(bytes: Buffer): Promise<string> {
  let format: string | undefined;
  try {
    format = (await sharp(bytes).metadata()).format;
  } catch {
    throw new ImageInputError("That file isn't a readable image");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new ImageInputError("Images must be JPEG, PNG, WebP or GIF");
  return `data:image/${format};base64,${bytes.toString("base64")}`;
}

async function loadGeneratedImage(userId: string, generationId: string, index: number): Promise<string> {
  const { data } = await createAdminClient()
    .from("image_generations")
    .select("images")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();
  const images: unknown[] = Array.isArray(data?.images) ? data.images : [];
  const image = images[index];
  if (typeof image !== "string" || !DATA_URL_PATTERN.test(image)) {
    throw new ImageInputError(`Couldn't find image ${index + 1} of that Verlab image generation`);
  }
  return image;
}

/** Resolves one image input to a validated base64 data URL, or throws ImageInputError with a user-facing message. */
export async function resolveImageInput(userId: string, raw: string): Promise<string> {
  const value = raw.trim();
  if (!value) throw new ImageInputError("Image input is empty");

  const ref = value.match(IMAGE_REF_PATTERN);
  if (ref) return loadGeneratedImage(userId, ref[1], Number(ref[2]));

  const signed = parseSignedMediaUrl(value);
  if (signed) {
    if (signed.kind !== "image") throw new ImageInputError("That Verlab link isn't an image");
    return loadGeneratedImage(userId, signed.id, signed.index);
  }

  if (DATA_URL_PATTERN.test(value)) {
    const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
    if (bytes.byteLength > MAX_INPUT_IMAGE_BYTES) throw new ImageInputError("That image is larger than 8MB");
    return toValidatedDataUrl(bytes);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ImageInputError(
      'Pass an image as a Verlab image ref ("image:<id>:<n>" from generate_image), an https image URL, or a data URL'
    );
  }
  return toValidatedDataUrl(await fetchPublicImage(parsed.toString()));
}

export async function resolveImageInputs(userId: string, raws: string[]): Promise<string[]> {
  return Promise.all(raws.map((raw) => resolveImageInput(userId, raw)));
}
