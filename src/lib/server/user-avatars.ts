import { isAvatarAgeRange, isAvatarGender, type AvatarSource, type UserAvatar } from "@/lib/config/avatars";

/** Private bucket holding each saved avatar at <user_id>/<avatar_id>.jpg (see the user_avatars migration). */
export const USER_AVATAR_BUCKET = "user-avatars";

export const USER_AVATAR_SELECT = "id, name, gender, age_range, source, created_at";

export interface UserAvatarRow {
  id: string;
  name: string;
  gender: string | null;
  age_range: string | null;
  source: string;
  created_at: string;
}

export function toUserAvatar(row: UserAvatarRow): UserAvatar {
  return {
    id: row.id,
    name: row.name,
    gender: isAvatarGender(row.gender) ? row.gender : null,
    ageRange: isAvatarAgeRange(row.age_range) ? row.age_range : null,
    source: row.source as AvatarSource,
    createdAt: row.created_at,
  };
}

/** Sent with a 503 when the library's table or bucket doesn't exist, so the client can stop offering New avatar. */
export const AVATAR_LIBRARY_UNAVAILABLE = "avatar_library_unavailable";

/**
 * True when the user_avatars migration hasn't been applied: PostgREST's
 * "table not in schema cache" (PGRST205), Postgres undefined_table (42P01),
 * or Storage's "Bucket not found".
 */
export function isAvatarLibraryMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || /bucket not found/i.test(error.message ?? "");
}

export function logAvatarLibraryMissing(context: string, error: unknown): void {
  console.error(
    `[${context}] avatar library is not set up -- apply supabase/migrations/20261104120000_user_avatars.sql (creates user_avatars + the user-avatars bucket)`,
    error
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params are user input -- a malformed id would otherwise surface as a Postgres uuid cast error. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
