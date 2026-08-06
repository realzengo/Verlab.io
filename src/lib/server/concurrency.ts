/**
 * Runs `fn` over `items` with at most `limit` in flight at once. Used by
 * /api/generate-voiceover to fan out per-segment Replicate calls without
 * either serializing them (slow for a long script) or firing all of them at
 * once (risks tripping Replicate's own rate limits on a big script).
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
