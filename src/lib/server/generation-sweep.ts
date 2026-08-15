import type { createClient } from "@/lib/supabase/server";

interface SweepableRow {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

/**
 * Sweeps rows still sitting in one of `staleStatuses` past `staleMs` to
 * "failed" in place, mutating `rows` to match what was written -- shared by
 * the generate-image/generate-voiceover/generate-video list (and, for
 * image/voiceover, single-row) GET paths so a row stuck by a missed
 * background-job completion (redeploy, uncaught crash, a hard maxDuration
 * kill) gets reconciled no matter which route last touched it.
 */
export async function sweepStaleRows<T extends SweepableRow>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  rows: T[],
  staleStatuses: readonly string[],
  staleMs: number
): Promise<void> {
  const staleIds = rows
    .filter((row) => staleStatuses.includes(row.status) && Date.now() - new Date(row.created_at).getTime() > staleMs)
    .map((row) => row.id);

  if (staleIds.length === 0) return;

  const timeoutMessage = "Generation timed out. Please try again.";
  await supabase.from(table).update({ status: "failed", error_message: timeoutMessage }).in("id", staleIds);
  for (const row of rows) {
    if (staleIds.includes(row.id)) {
      row.status = "failed";
      row.error_message = timeoutMessage;
    }
  }
}
