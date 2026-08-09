import { NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverAndIngestTrendingTikTokChannels } from "@/lib/server/faceless-tiktok-discovery";
import { SociaVaultError } from "@/lib/server/sociavault-client";

// Gives discovery room to run without hitting the platform's default route
// timeout.
export const maxDuration = 300;

/**
 * Discovers real trending TikTok authors via SociaVault's faceless-hashtag
 * search and upserts them into niche_channels -- raw, unclassified. There is
 * deliberately no Gemini faceless-verification pass here anymore (removed
 * 2026-08-09): rows land with is_faceless/faceless_confidence left null
 * ("Unverified" in the admin table) and are immediately visible on the
 * public Niche Finder page, since getFacelessChannels() and the
 * niche_channels RLS policy no longer require is_faceless=true (see
 * supabase/migrations/20260809120000_niche_channels_drop_faceless_gate.sql).
 * Manual classification is still available per-channel or via "Batch
 * Classify" in the admin UI for anyone who wants it -- it's just no longer
 * automatic or required to surface publicly.
 */
export async function POST(): Promise<Response> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const discovered = await discoverAndIngestTrendingTikTokChannels(admin);
    return NextResponse.json({ ingestedCount: discovered.length });
  } catch (err) {
    const message = err instanceof SociaVaultError ? err.message : "Failed to discover trending TikTok channels";
    console.error("[ingest-tiktok] discovery failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
