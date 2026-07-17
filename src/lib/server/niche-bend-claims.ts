import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NicheBendAngle, NicheBendPlatform, NicheClaim } from "@/lib/types";

// Thrown when a niche was claimed by someone else between the moment a user
// picked a bend candidate and the moment they hit "Generate my SOP" — the
// only place this can actually happen, since candidate generation already
// filters out claimed niches before they're ever shown.
export class NicheAlreadyClaimedError extends Error {
  constructor(nicheName: string) {
    super(`"${nicheName}" was just claimed by another creator. Pick a different direction.`);
    this.name = "NicheAlreadyClaimedError";
  }
}

// Normalizes to the string used for the uniqueness lock: case/whitespace/
// punctuation shouldn't let two people claim what's obviously the same
// niche ("Wall Street Breakdowns" vs "wall-street breakdowns!").
const COMBINING_DIACRITICS = new RegExp("[̀-ͯ]", "g");

export function normalizeNicheKey(nicheName: string): string {
  return nicheName
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

interface NicheClaimRow {
  id: string;
  niche_name: string;
  angle: NicheBendAngle;
  example_titles: string[];
  channel_name: string | null;
  avatar_url: string | null;
  platform: NicheBendPlatform;
  user_id: string;
  created_at: string;
}

const CLAIM_COLUMNS =
  "id, niche_name, angle, example_titles, channel_name, avatar_url, platform, user_id, created_at";

export interface ClaimedNicheAvoidance {
  keys: Set<string>; // normalized, for the post-generation collision check
  names: string[]; // display names, for the AI prompt's avoid-list
}

// Best-effort read used to steer generation away from taken niches. A
// failure here must never fail the whole analysis — it just means the AI
// doesn't get the avoid-list this one time, and the claim-time check in
// claimNiche() remains the real enforcement backstop regardless.
export async function getClaimedNichesForAvoidance(limit = 500): Promise<ClaimedNicheAvoidance> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("niche_claims")
      .select("niche_key, niche_name")
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = (data as { niche_key: string; niche_name: string }[] | null) ?? [];
    return {
      keys: new Set(rows.map((row) => row.niche_key)),
      names: rows.map((row) => row.niche_name),
    };
  } catch (error) {
    console.error("[niche-bend] Could not read claimed niches, continuing without avoid-list:", error);
    return { keys: new Set(), names: [] };
  }
}

// Atomic "first writer wins" claim: relies entirely on the unique constraint
// on niche_key rather than a check-then-insert, so two users finalizing the
// same niche at the same instant can't both succeed.
export async function claimNiche(input: {
  nicheName: string;
  angle: NicheBendAngle;
  exampleTitles: string[];
  userId: string;
  jobId: string;
  channelName: string | null;
  avatarUrl: string | null;
  platform: NicheBendPlatform;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("niche_claims").insert({
    niche_key: normalizeNicheKey(input.nicheName),
    niche_name: input.nicheName,
    angle: input.angle,
    example_titles: input.exampleTitles,
    user_id: input.userId,
    job_id: input.jobId,
    channel_name: input.channelName,
    avatar_url: input.avatarUrl,
    platform: input.platform,
  });

  if (!error) return true;
  if (error.code === "23505") return false; // unique_violation — someone else beat us to it
  throw new Error(`Failed to claim niche: ${error.message}`);
}

// Public "wall of fame" feed — every signed-in user can see every claim,
// that's the point (it's the scarcity signal). Reads go through the
// caller's own request-scoped client since the table's select policy is
// already open to any authenticated user; no need for the admin client here.
export async function listClaimedNiches(
  supabase: SupabaseClient,
  viewerId: string,
  limit = 24
): Promise<NicheClaim[]> {
  const { data } = await supabase
    .from("niche_claims")
    .select(CLAIM_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data as NicheClaimRow[] | null) ?? []).map((row) => ({
    id: row.id,
    nicheName: row.niche_name,
    angle: row.angle,
    exampleTitles: row.example_titles,
    channelName: row.channel_name,
    avatarUrl: row.avatar_url,
    platform: row.platform,
    createdAt: row.created_at,
    isMine: row.user_id === viewerId,
  }));
}
