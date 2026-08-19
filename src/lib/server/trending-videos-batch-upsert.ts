import type { SupabaseClient } from "@supabase/supabase-js";

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
 */
export async function batchUpsertTrendingVideos(
  admin: SupabaseClient,
  rows: TrendingVideoUpsertRow[],
  context = "trending-videos-batch-upsert"
): Promise<BatchUpsertSummary> {
  if (rows.length === 0) {
    return { totalRows: 0, upsertedRows: 0, chunkCount: 0, failedChunks: 0 };
  }

  const chunks = chunk(rows, UPSERT_CHUNK_SIZE);
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
    }
  }

  await Promise.all(Array.from({ length: Math.min(UPSERT_CONCURRENCY, chunks.length) }, worker));

  return { totalRows: rows.length, upsertedRows, chunkCount: chunks.length, failedChunks };
}
