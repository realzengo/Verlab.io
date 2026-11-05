"use client";

import type { AvatarAgeRange, AvatarGender, AvatarSource, UserAvatar } from "@/lib/config/avatars";

// Matches AVATAR_LIBRARY_UNAVAILABLE in lib/server/user-avatars.ts.
const LIBRARY_UNAVAILABLE_CODE = "avatar_library_unavailable";

export interface AvatarLibrary {
  avatars: UserAvatar[];
  /** False when the server has no avatar library set up -- presets still work, saving doesn't. */
  available: boolean;
}

// Last list fetched this session -- reopening the picker renders it at once
// and refreshes in the background instead of flashing a skeleton every time.
let cachedLibrary: AvatarLibrary | null = null;

export function getCachedAvatarLibrary(): AvatarLibrary | null {
  return cachedLibrary;
}

/** A failed save. `unavailable` means the server has no avatar library set up, not a one-off error. */
export class AvatarSaveError extends Error {
  constructor(
    message: string,
    readonly unavailable: boolean
  ) {
    super(message);
  }
}

async function readError(response: Response, fallback: string): Promise<{ message: string; code: string | null }> {
  const data = await response.json().catch(() => null);
  return {
    message: typeof data?.error === "string" ? data.error : fallback,
    code: typeof data?.code === "string" ? data.code : null,
  };
}

export async function fetchAvatarLibrary(): Promise<AvatarLibrary> {
  const response = await fetch("/api/avatars", { cache: "no-store" });
  if (!response.ok) throw new Error((await readError(response, "Could not load your avatars.")).message);
  const data = await response.json();
  cachedLibrary = {
    avatars: Array.isArray(data.avatars) ? data.avatars : [],
    available: data.libraryAvailable !== false,
  };
  return cachedLibrary;
}

export interface NewAvatarInput {
  image: string;
  name: string;
  gender: AvatarGender | null;
  ageRange: AvatarAgeRange | null;
  source: AvatarSource;
}

export async function createUserAvatar(input: NewAvatarInput): Promise<UserAvatar> {
  let response: Response;
  try {
    response = await fetch("/api/avatars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new AvatarSaveError("Couldn't reach the server. Check your connection and try again.", false);
  }
  if (!response.ok) {
    const { message, code } = await readError(response, "Could not save your avatar. Please try again.");
    const unavailable = code === LIBRARY_UNAVAILABLE_CODE;
    if (unavailable && cachedLibrary) cachedLibrary = { ...cachedLibrary, available: false };
    throw new AvatarSaveError(message, unavailable);
  }
  const { avatar } = (await response.json()) as { avatar: UserAvatar };
  cachedLibrary = { avatars: [avatar, ...(cachedLibrary?.avatars ?? []).filter((item) => item.id !== avatar.id)], available: true };
  return avatar;
}

export async function deleteUserAvatar(id: string): Promise<void> {
  const response = await fetch(`/api/avatars/${id}`, { method: "DELETE" });
  // Already gone counts as deleted.
  if (!response.ok && response.status !== 404) throw new Error((await readError(response, "Could not delete that avatar.")).message);
  if (cachedLibrary) cachedLibrary = { ...cachedLibrary, avatars: cachedLibrary.avatars.filter((item) => item.id !== id) };
}
