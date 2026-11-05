import presets from "@/lib/config/clone-presets.json";

/**
 * The avatar picker (Video Generator > Clone > "Choose avatar"): bundled
 * preset avatars plus each user's own, stored in the `user_avatars` table.
 * The picker's filter pills match on gender and age bucket. Presets always
 * carry both; a user's avatar may leave either unset.
 */
export const AVATAR_GENDERS = ["female", "male"] as const;
export type AvatarGender = (typeof AVATAR_GENDERS)[number];

// The competitor's buckets -- there's deliberately no 50s.
export const AVATAR_AGE_RANGES = ["20s", "30s", "40s", "60s"] as const;
export type AvatarAgeRange = (typeof AVATAR_AGE_RANGES)[number];

export const AVATAR_SOURCES = ["generated", "uploaded"] as const;
export type AvatarSource = (typeof AVATAR_SOURCES)[number];

export const AVATAR_NAME_MAX = 60;
export const MAX_USER_AVATARS = 100;

/** A user's saved avatar, as GET/POST /api/avatars return it. */
export interface UserAvatar {
  id: string;
  name: string;
  gender: AvatarGender | null;
  ageRange: AvatarAgeRange | null;
  source: AvatarSource;
  createdAt: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  gender: AvatarGender;
  ageRange: AvatarAgeRange;
}

export const AVATAR_PRESETS: AvatarPreset[] = (presets as { id: string; name: string; gender: AvatarGender; age: AvatarAgeRange }[]).map(
  ({ id, name, gender, age }) => ({ id, name, gender, ageRange: age })
);

/** Static file each preset was rendered to by scripts/generate-clone-presets.mjs. */
export function avatarPresetImagePath(id: string): string {
  return `/clone-presets/${id}.jpg`;
}

/** A saved avatar's image. `width` asks the route for a resized WebP thumbnail. */
export function userAvatarImagePath(id: string, width?: number): string {
  return width ? `/api/avatars/${id}/image?w=${width}` : `/api/avatars/${id}/image`;
}

export function isAvatarGender(value: unknown): value is AvatarGender {
  return typeof value === "string" && (AVATAR_GENDERS as readonly string[]).includes(value);
}

export function isAvatarAgeRange(value: unknown): value is AvatarAgeRange {
  return typeof value === "string" && (AVATAR_AGE_RANGES as readonly string[]).includes(value);
}
