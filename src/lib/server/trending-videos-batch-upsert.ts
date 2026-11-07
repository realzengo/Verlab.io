import type { SupabaseClient } from "@supabase/supabase-js";
import { copyNewTikTokCovers, keepStoredCovers, type CoverCopySummary } from "@/lib/server/tiktok-covers";

// Shape of a single trending_videos row as written by any ingestion path
// (routine cron, on-demand cache-aside refresh, or the deep backfill route).
// Kept intentionally loose (Record) rather than importing TrendingVideoRow --
// callers upsert plain objects built from provider responses, not rows read
// back from the DB.
export type TrendingVideoUpsertRow = Record<string, unknown> & { id: string };

// A single upsert() call carrying thousands of rows (a full-catalog TikTok
// scrape, or a deep multi-niche backfill tick) risks a large payload, a
// long-held statement, and -- confirmed by a real past incident (see
// truncateSafely in sociavault-client.ts) -- one malformed row poisoning the
// *entire* batch and losing every other niche's good data along with it.
// Chunking bounds payload size and blast radius: a bad chunk fails on its
// own, every other chunk still lands.
const UPSERT_CHUNK_SIZE = 300;

// Each in-flight upsert holds a connection from Supabase's pooler for the
// duration of the statement. Firing every chunk at once (a backfill run can
// produce dozens of chunks) would spike concurrent pooled connections right
// alongside whatever else is hitting the database (checkout, RLS-scoped user
// reads, other crons). A small worker pool caps how many chunks are ever
// in flight together, independent of how many total chunks there are.
const UPSERT_CONCURRENCY = 3;

export interface BatchUpsertSummary {
  totalRows: number;
  upsertedRows: number;
  chunkCount: number;
  failedChunks: number;
  covers: CoverCopySummary;
}

export interface BatchUpsertOptions {
  // How long to spend copying new TikTok covers into storage after the
  // upsert (see tiktok-covers.ts). Defaults to a short budget suited to an
  // on-demand scrape; crons with time to spare pass more.
  coverCopyBudgetMs?: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Upserts a (potentially large) array of trending_videos rows in bounded-size,
 * bounded-concurrency chunks. A failed chunk is logged and skipped rather
 * than aborting the run -- callers get back exactly how many rows actually
 * landed instead of an all-or-nothing throw.
 *
 * TikTok cover links are signed and expire within days, so this also keeps
 * each row's stored cover copy across re-scrapes and copies the covers of
 * rows that don't have one yet. Every ingestion path goes through here, so
 * none of them can forget to.
 */
export async function batchUpsertTrendingVideos(
  admin: SupabaseClient,
  rows: TrendingVideoUpsertRow[],
  context = "trending-videos-batch-upsert",
  options: BatchUpsertOptions = {}
): Promise<BatchUpsertSummary> {
  if (rows.length === 0) {
    return {
      totalRows: 0,
      upsertedRows: 0,
      chunkCount: 0,
      failedChunks: 0,
      covers: { attempted: 0, copied: 0, failed: 0, deferred: 0 },
    };
  }

  const chunks = chunk(await keepStoredCovers(admin, rows), UPSERT_CHUNK_SIZE);
  const upserted: TrendingVideoUpsertRow[] = [];
  let upsertedRows = 0;
  let failedChunks = 0;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (let i = nextIndex++; i < chunks.length; i = nextIndex++) {
      const batch = chunks[i];
      const { error } = await admin.from("trending_videos").upsert(batch, { onConflict: "id" });
      if (error) {
        failedChunks++;
        console.error(
          `[${context}] upsert chunk ${i + 1}/${chunks.length} failed (${batch.length} rows):`,
          error.message
        );
        continue;
      }
      upsertedRows += batch.length;
      upserted.push(...batch);
    }
  }

  await Promise.all(Array.from({ length: Math.min(UPSERT_CONCURRENCY, chunks.length) }, worker));

  // After the upsert, not before: the rows land with their (still working)
  // signed links first, so a slow copy never delays or loses the data itself.
  const covers = await copyNewTikTokCovers(admin, upserted, options.coverCopyBudgetMs);
  if (covers.failed > 0 || covers.deferred > 0) {
    console.warn(`[${context}] TikTok covers: ${covers.copied} copied, ${covers.failed} failed, ${covers.deferred} deferred`);
  }

  return { totalRows: rows.length, upsertedRows, chunkCount: chunks.length, failedChunks, covers };
}
