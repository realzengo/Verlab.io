import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBucket } from "@/lib/supabase/admin";
import { VIDEO_COVERS_BUCKET, isStoredVideoCover, pickBrowserImageUrl } from "@/lib/video-covers";

// TikTok serves cover images as signed CDN links that expire (x-expires)
// anywhere from a day to two weeks after the scrape, and its oEmbed endpoint
// stopped returning thumbnail_url, so a dead link can't be re-minted that
// way either. Every Niche Finder card whose link had lapsed rendered as a
// blank gradient. So each cover is copied into our own public bucket while
// its signed link still works, and trending_videos/saved_videos point at the
// copy from then on:
//
//   - batchUpsertTrendingVideos copies new covers right after every scrape
//     and never lets a re-scrape point a row back at a signed link;
//   - /api/cron/tiktok-covers sweeps up rows that copy missed;
//   - /api/media/tiktok-thumb heals a single cover the moment a card shows it
//     un-copied.
//
// One object per video at tiktok/<video id>, re-encoded to WebP.

const FETCH_TIMEOUT_MS = 8_000;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
// Cards render about 300px wide and the detail modal about 360px, so 720
// covers both at 2x. Sources are 720 wide or less, so this rarely resizes;
// the WebP re-encode is what cuts a ~150KB JPEG to ~50KB.
const STORED_WIDTH_PX = 720;
const COPY_CONCURRENCY = 8;
const DEFAULT_COPY_BUDGET_MS = 20_000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Only TikTok's own image CDNs. Source URLs come from scraped data or TikTok's
// own page, never straight from a client, and this keeps it that way.
const TIKTOK_IMAGE_HOST = /(^|\.)(tiktokcdn(-[a-z]+)?\.com|ibyteimg\.com|byteimg\.com)$/;
const TIKTOK_PAGE_HOST = /(^|\.)tiktok\.com$/;

function isHttpsUrlOn(url: string, host: RegExp): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && host.test(parsed.hostname);
  } catch {
    return false;
  }
}

// When a signed link stops working, from its x-expires param (epoch
// seconds). 0 when there's no link or no stamp to go on.
function linkExpiresAt(url: string): number {
  const seconds = Number(url.match(/[?&]x-expires=(\d+)/)?.[1]);
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

// Worth downloading: not past its x-expires, and not HEIC, which sharp can't
// decode (and TikTok's signature breaks if the extension is swapped).
function isCopyableLink(url: string): boolean {
  if (/\.heic(\?|$)/i.test(url)) return false;
  const expiresAt = linkExpiresAt(url);
  return expiresAt === 0 || expiresAt > Date.now();
}

function storagePath(videoId: string): string {
  return `tiktok/${videoId}`;
}

function storedCoverUrl(admin: SupabaseClient, videoId: string): string {
  return admin.storage.from(VIDEO_COVERS_BUCKET).getPublicUrl(storagePath(videoId)).data.publicUrl;
}

let bucketReady: Promise<void> | null = null;

function ensureCoversBucket(admin: SupabaseClient): Promise<void> {
  bucketReady ??= ensureBucket(admin, VIDEO_COVERS_BUCKET, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"],
  }).catch((err) => {
    bucketReady = null;
    throw err;
  });
  return bucketReady;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  if (!isHttpsUrlOn(url, TIKTOK_IMAGE_HOST)) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    if (Number(res.headers.get("content-length") ?? "0") > MAX_SOURCE_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_SOURCE_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Copies one cover into the bucket and returns its public URL, or null when
 * the source didn't yield a usable image (expired link, HEIC, not an image).
 */
async function copyCover(admin: SupabaseClient, videoId: string, sourceUrl: string): Promise<string | null> {
  const bytes = await fetchImage(sourceUrl);
  if (!bytes) return null;

  let webp: Buffer;
  try {
    webp = await sharp(bytes)
      .resize({ width: STORED_WIDTH_PX, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    // HEIC (sharp's prebuilt libvips has no HEVC decoder) or a corrupt file.
    return null;
  }

  await ensureCoversBucket(admin);
  const { error } = await admin.storage.from(VIDEO_COVERS_BUCKET).upload(storagePath(videoId), webp, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) {
    console.warn(`[tiktok-covers] upload failed for ${videoId}:`, error.message);
    return null;
  }
  return storedCoverUrl(admin, videoId);
}

async function pointRowsAtCover(admin: SupabaseClient, videoId: string, url: string): Promise<void> {
  const [trending, saved] = await Promise.all([
    admin.from("trending_videos").update({ cover_url: url }).eq("id", videoId).eq("platform", "tiktok"),
    admin.from("saved_videos").update({ cover_url: url }).eq("video_id", videoId).eq("platform", "tiktok"),
  ]);
  if (trending.error) console.warn(`[tiktok-covers] trending_videos update failed for ${videoId}:`, trending.error.message);
  if (saved.error) console.warn(`[tiktok-covers] saved_videos update failed for ${videoId}:`, saved.error.message);
}

interface TikTokPageItem {
  video?: { cover?: unknown; originCover?: unknown };
  imagePost?: { cover?: { imageURL?: { urlList?: unknown } } };
}

// Once TikTok answers with its "Please wait..." challenge page it keeps doing
// so for a while, so further page requests from this instance are skipped
// until then instead of piling on.
const PAGE_BLOCKED_BACKOFF_MS = 15 * 60 * 1000;
let pageBlockedUntil = 0;
let oembedThumbnaillessUntil = 0;

/**
 * Freshly signed cover URLs for a video. TikTok's video page embeds them in
 * its rehydration JSON. That works from most networks, but TikTok often
 * answers datacenter IPs (and any IP after a burst of requests) with a
 * challenge page instead, so oEmbed is tried as well, in case thumbnail_url
 * ever comes back for some region.
 */
async function fetchFreshCoverUrls(videoUrl: string): Promise<string[]> {
  if (!isHttpsUrlOn(videoUrl, TIKTOK_PAGE_HOST)) return [];
  const urls: string[] = [];

  try {
    if (Date.now() < pageBlockedUntil) throw new Error("TikTok page requests backing off");
    const res = await fetch(videoUrl, {
      headers: { "User-Agent": BROWSER_USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    const html = res.ok ? await res.text() : "";
    const json = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (!json && (res.status === 403 || res.status === 429 || html.includes("_wafchallengeid"))) {
      pageBlockedUntil = Date.now() + PAGE_BLOCKED_BACKOFF_MS;
    }
    if (json) {
      const item: TikTokPageItem | undefined = JSON.parse(json)?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo
        ?.itemStruct;
      const imagePostUrls = item?.imagePost?.cover?.imageURL?.urlList;
      const pageImageUrl = pickBrowserImageUrl(
        Array.isArray(imagePostUrls) ? imagePostUrls.filter((u): u is string => typeof u === "string") : undefined
      );
      for (const url of [item?.video?.cover, item?.video?.originCover, pageImageUrl]) {
        if (typeof url === "string" && url) urls.push(url);
      }
    }
  } catch {
    // Challenge page, changed markup or timeout: fall through to oEmbed.
  }

  if (urls.length === 0 && Date.now() >= oembedThumbnaillessUntil) {
    try {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const thumbnailUrl = res.ok ? ((await res.json()) as { thumbnail_url?: unknown }).thumbnail_url : undefined;
      if (typeof thumbnailUrl === "string" && thumbnailUrl) {
        urls.push(thumbnailUrl);
      } else if (res.ok) {
        // A found video with no thumbnail means oEmbed is omitting it for
        // everyone right now, not just for this video.
        oembedThumbnaillessUntil = Date.now() + PAGE_BLOCKED_BACKOFF_MS;
      }
    } catch {
      // Nothing left to try.
    }
  }

  return urls;
}

async function storedCopyExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Makes sure one TikTok video's cover is copied into storage and every row
 * for it points at the copy. Tries, in order: an existing copy, the signed
 * links already on its rows, then fresh ones from TikTok. Returns the
 * stored URL, or null when TikTok gave us nothing usable (deleted video,
 * blocked request).
 */
export async function healTikTokCover(admin: SupabaseClient, videoId: string, videoUrl: string): Promise<string | null> {
  const existing = storedCoverUrl(admin, videoId);
  if (await storedCopyExists(existing)) {
    await pointRowsAtCover(admin, videoId, existing);
    return existing;
  }

  const [trending, saved] = await Promise.all([
    admin.from("trending_videos").select("cover_url").eq("id", videoId).eq("platform", "tiktok").maybeSingle(),
    admin.from("saved_videos").select("cover_url").eq("video_id", videoId).eq("platform", "tiktok").limit(5),
  ]);
  const knownUrls = new Set<string>();
  for (const row of [trending.data, ...(saved.data ?? [])]) {
    const url = row?.cover_url;
    if (typeof url === "string" && url && !isStoredVideoCover(url) && isCopyableLink(url)) knownUrls.add(url);
  }

  for (const url of knownUrls) {
    const stored = await copyCover(admin, videoId, url);
    if (stored) {
      await pointRowsAtCover(admin, videoId, stored);
      return stored;
    }
  }

  for (const url of await fetchFreshCoverUrls(videoUrl)) {
    const stored = await copyCover(admin, videoId, url);
    if (stored) {
      await pointRowsAtCover(admin, videoId, stored);
      return stored;
    }
  }

  return null;
}

type CoverRow = Record<string, unknown> & { id: string };

function isUncopiedTikTokCover(row: CoverRow): row is CoverRow & { cover_url: string } {
  return row.platform === "tiktok" && typeof row.cover_url === "string" && row.cover_url !== "" && !isStoredVideoCover(row.cover_url);
}

/**
 * Swaps each freshly scraped TikTok row's signed cover link for its stored
 * copy when one already exists, so re-upserting a still-trending video never
 * points it back at a link that's about to die.
 */
export async function keepStoredCovers<T extends CoverRow>(admin: SupabaseClient, rows: T[]): Promise<T[]> {
  const ids = rows.filter(isUncopiedTikTokCover).map((row) => row.id);
  if (ids.length === 0) return rows;

  const stored = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from("trending_videos")
      .select("id, cover_url")
      .in("id", ids.slice(i, i + 200))
      .like("cover_url", `%/${VIDEO_COVERS_BUCKET}/%`);
    if (error) {
      // The copy step after the upsert re-copies whatever this missed.
      console.warn("[tiktok-covers] stored-cover lookup failed:", error.message);
      continue;
    }
    for (const row of data ?? []) stored.set(row.id, row.cover_url);
  }

  return rows.map((row) => {
    const url = stored.get(row.id);
    return url && isUncopiedTikTokCover(row) ? { ...row, cover_url: url } : row;
  });
}

export interface CoverCopySummary {
  attempted: number;
  copied: number;
  failed: number;
  // Left un-copied because the time budget ran out first; the sweep cron or
  // the thumbnail proxy picks these up.
  deferred: number;
}

async function runWithBudget<T>(
  items: T[],
  budgetMs: number,
  concurrency: number,
  task: (item: T) => Promise<boolean>
): Promise<CoverCopySummary> {
  const deadline = Date.now() + budgetMs;
  let nextIndex = 0;
  let attempted = 0;
  let copied = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length && Date.now() < deadline) {
      const item = items[nextIndex++];
      attempted++;
      try {
        if (await task(item)) copied++;
      } catch (err) {
        console.warn("[tiktok-covers] copy failed:", err);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { attempted, copied, failed: attempted - copied, deferred: items.length - attempted };
}

/**
 * Copies the covers of just-upserted TikTok rows that still point at signed
 * links. Bounded by a time budget so an on-demand scrape a user is waiting on
 * isn't held up; whatever's left is deferred to the sweep cron.
 */
export async function copyNewTikTokCovers(
  admin: SupabaseClient,
  rows: CoverRow[],
  budgetMs: number = DEFAULT_COPY_BUDGET_MS
): Promise<CoverCopySummary> {
  const pending = rows.filter(isUncopiedTikTokCover).filter((row) => isCopyableLink(row.cover_url));
  return runWithBudget(pending, budgetMs, COPY_CONCURRENCY, async (row) => {
    const stored = await copyCover(admin, row.id, row.cover_url);
    if (stored) await pointRowsAtCover(admin, row.id, stored);
    return Boolean(stored);
  });
}

const SWEEP_PAGE_SIZE = 1000; // PostgREST's max rows per request

/**
 * Sweeps TikTok rows whose cover still isn't a stored copy (copy budget ran
 * out, upload failed, or the scrape had no cover) and heals them. Rows whose
 * signed link expires last go first: those copy straight from the link we
 * already have, while expired ones depend on TikTok's page answering, so
 * they must never crowd healable rows out of the batch.
 */
export async function healUncopiedTikTokCovers(
  admin: SupabaseClient,
  batchSize: number,
  budgetMs: number
): Promise<CoverCopySummary> {
  // The TikTok pool is a couple thousand rows at most (pruned after a week
  // unrefreshed), so reading every un-copied row's link to rank them is cheap.
  const rows: { id: string; video_url: string; cover_url: string }[] = [];
  for (let from = 0; ; from += SWEEP_PAGE_SIZE) {
    const { data, error } = await admin
      .from("trending_videos")
      .select("id, video_url, cover_url")
      .eq("platform", "tiktok")
      .not("cover_url", "like", `%/${VIDEO_COVERS_BUCKET}/%`)
      .order("id")
      .range(from, from + SWEEP_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < SWEEP_PAGE_SIZE) break;
  }

  const rank = (url: string) => (isCopyableLink(url) && url ? linkExpiresAt(url) || Infinity : 0);
  rows.sort((a, b) => rank(b.cover_url) - rank(a.cover_url));

  return runWithBudget(rows.slice(0, batchSize), budgetMs, COPY_CONCURRENCY, async (row) =>
    Boolean(await healTikTokCover(admin, row.id, row.video_url))
  );
}

/**
 * Deletes the stored covers of TikTok videos whose trending_videos rows were
 * just pruned, except ones a user has saved: saved_videos keeps rendering a
 * video after its trending row is gone.
 */
export async function removeCoversOfPrunedVideos(admin: SupabaseClient, videoIds: string[]): Promise<void> {
  for (let i = 0; i < videoIds.length; i += 200) {
    const ids = videoIds.slice(i, i + 200);
    const { data: saved, error } = await admin.from("saved_videos").select("video_id").in("video_id", ids);
    if (error) {
      console.warn("[tiktok-covers] saved-video lookup failed, keeping covers:", error.message);
      continue;
    }
    const keep = new Set((saved ?? []).map((row) => row.video_id));
    const paths = ids.filter((id) => !keep.has(id)).map(storagePath);
    if (paths.length === 0) continue;
    const { error: removeError } = await admin.storage.from(VIDEO_COVERS_BUCKET).remove(paths);
    if (removeError) console.warn("[tiktok-covers] cover cleanup failed:", removeError.message);
  }
}
