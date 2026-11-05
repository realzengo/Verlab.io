import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp, { type OutputInfo } from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { isValidName } from "@/lib/validation";
import {
  AVATAR_LIBRARY_UNAVAILABLE,
  USER_AVATAR_BUCKET,
  USER_AVATAR_SELECT,
  isAvatarLibraryMissing,
  logAvatarLibraryMissing,
  toUserAvatar,
} from "@/lib/server/user-avatars";
import { AVATAR_NAME_MAX, AVATAR_SOURCES, MAX_USER_AVATARS, isAvatarAgeRange, isAvatarGender } from "@/lib/config/avatars";

// The client normalizes to a ~1536px JPEG before posting (well under 1MB),
// so this only stops abuse -- base64 inflates by 4/3, plus room for the
// JSON wrapper.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16 * 1024;
const MIN_IMAGE_SIDE_PX = 256;
const STORED_MAX_SIDE_PX = 1536;
const DATA_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

function libraryUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Avatar saving is temporarily unavailable. Please try again in a moment.", code: AVATAR_LIBRARY_UNAVAILABLE },
    { status: 503 }
  );
}

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_avatars")
    .select(USER_AVATAR_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_USER_AVATARS);

  if (isAvatarLibraryMissing(error)) {
    // The presets still work without the library -- say so instead of failing the picker.
    logAvatarLibraryMissing("avatars GET", error);
    return NextResponse.json({ avatars: [], libraryAvailable: false });
  }
  if (error) {
    return serverError("avatars GET", error);
  }

  return NextResponse.json({ avatars: (data ?? []).map(toUserAvatar), libraryAvailable: true });
}

interface CreateAvatarBody {
  image?: unknown;
  name?: unknown;
  gender?: unknown;
  ageRange?: unknown;
  source?: unknown;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`avatars:${user.id}`, 20, 60))) {
    return rateLimitedResponse();
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json({ error: "That image is too large (max 8MB)." }, { status: 413 });
  }

  let body: CreateAvatarBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { image, name, gender = null, ageRange = null, source } = body;

  if (typeof name !== "string" || !isValidName(name, AVATAR_NAME_MAX)) {
    return NextResponse.json(
      { error: `Give your avatar a name of up to ${AVATAR_NAME_MAX} characters (letters, numbers and basic punctuation).` },
      { status: 400 }
    );
  }
  if (gender !== null && !isAvatarGender(gender)) {
    return NextResponse.json({ error: "gender must be female, male or null" }, { status: 400 });
  }
  if (ageRange !== null && !isAvatarAgeRange(ageRange)) {
    return NextResponse.json({ error: "ageRange must be one of the supported options or null" }, { status: 400 });
  }
  if (typeof source !== "string" || !(AVATAR_SOURCES as readonly string[]).includes(source)) {
    return NextResponse.json({ error: "source must be generated or uploaded" }, { status: 400 });
  }
  if (typeof image !== "string" || !DATA_URL_PATTERN.test(image)) {
    return NextResponse.json({ error: "image must be a base64 image data URL" }, { status: 400 });
  }
  if ((image.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That image is too large (max 8MB)." }, { status: 413 });
  }

  // Checked before the image work below, so a full library (or one that
  // isn't set up) fails fast. Not a HEAD request: against a missing table
  // HEAD answers count null with no error, which read as "0 avatars".
  const { count, error: countError } = await supabase
    .from("user_avatars")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .limit(1);
  if (isAvatarLibraryMissing(countError)) {
    logAvatarLibraryMissing("avatars POST", countError);
    return libraryUnavailableResponse();
  }
  if (countError || count === null) {
    return serverError("avatars POST count", countError ?? "count unavailable", "Could not save your avatar. Please try again.");
  }
  if (count >= MAX_USER_AVATARS) {
    return NextResponse.json(
      { error: `You've reached the ${MAX_USER_AVATARS}-avatar limit. Delete one to add another.` },
      { status: 400 }
    );
  }

  // The data-URL label is client-declared -- sniff the real bytes, then
  // re-encode. Re-encoding also bakes in EXIF rotation and drops every
  // metadata block (camera GPS included) before anything is stored.
  let stored: { data: Buffer; info: OutputInfo };
  try {
    const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
    const { format, width, height } = await sharp(bytes).metadata();
    if (!format || !ALLOWED_IMAGE_FORMATS.has(format)) {
      return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 400 });
    }
    if (!width || !height || Math.min(width, height) < MIN_IMAGE_SIDE_PX) {
      return NextResponse.json({ error: `That image is too small. Use one at least ${MIN_IMAGE_SIDE_PX}px on each side.` }, { status: 400 });
    }
    stored = await sharp(bytes)
      .rotate()
      .resize({ width: STORED_MAX_SIDE_PX, height: STORED_MAX_SIDE_PX, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return NextResponse.json({ error: "That file isn't a readable image." }, { status: 400 });
  }

  const id = randomUUID();
  const imagePath = `${user.id}/${id}.jpg`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(USER_AVATAR_BUCKET)
    .upload(imagePath, stored.data, { contentType: "image/jpeg", upsert: false });
  if (isAvatarLibraryMissing(uploadError)) {
    logAvatarLibraryMissing("avatars POST upload", uploadError);
    return libraryUnavailableResponse();
  }
  if (uploadError) {
    return serverError("avatars POST upload", uploadError, "Could not save your avatar. Please try again.");
  }

  const { data: row, error: insertError } = await supabase
    .from("user_avatars")
    .insert({
      id,
      user_id: user.id,
      name: name.trim(),
      gender,
      age_range: ageRange,
      source,
      image_path: imagePath,
      width: stored.info.width,
      height: stored.info.height,
    })
    .select(USER_AVATAR_SELECT)
    .single();

  if (insertError || !row) {
    // Nothing references the object without its row -- don't strand it.
    await admin.storage.from(USER_AVATAR_BUCKET).remove([imagePath]);
    if (isAvatarLibraryMissing(insertError)) {
      logAvatarLibraryMissing("avatars POST insert", insertError);
      return libraryUnavailableResponse();
    }
    return serverError("avatars POST insert", insertError, "Could not save your avatar. Please try again.");
  }

  return NextResponse.json({ avatar: toUserAvatar(row) }, { status: 201 });
}

export const GET = withApiLogging("/api/avatars", handleGET);
export const POST = withApiLogging("/api/avatars", handlePOST);
