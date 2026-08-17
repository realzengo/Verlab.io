import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient, removeUserStorageObjects } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";

// Every per-user Storage bucket in the app -- see each bucket's own
// migration comment for the `${userId}/...` key convention this relies on.
// `avatars` has no writer yet (nothing in app code uploads to it today) but
// is included so this doesn't quietly need updating the day that changes.
const USER_STORAGE_BUCKETS = ["videos", "voiceovers", "avatars"] as const;

export async function DELETE() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return serverError("account DELETE", error);
  }

  // The `on delete cascade` FKs on video_generations.user_id /
  // voiceover_generations.user_id just removed those DB rows, but Storage
  // objects aren't rows in those tables -- nothing about that cascade
  // reaches them. Clean them up here or they outlive the account forever.
  // Best-effort: the account is already gone at this point, so a cleanup
  // failure is logged (inside removeUserStorageObjects) and swallowed, not
  // reported as a failed deletion.
  await Promise.all(USER_STORAGE_BUCKETS.map((bucket) => removeUserStorageObjects(admin, bucket, user.id)));

  return NextResponse.json({ ok: true });
}
