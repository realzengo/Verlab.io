// TikTok covers are copied into this public Storage bucket (see
// lib/server/tiktok-covers.ts) because the signed CDN links TikTok hands out
// stop working within days. Shared with the client so a card can tell a
// stored copy from a link that may already be dead.
export const VIDEO_COVERS_BUCKET = "video-covers";

const STORED_COVER_MARKER = `/storage/v1/object/public/${VIDEO_COVERS_BUCKET}/`;

export function isStoredVideoCover(url: string | null | undefined): boolean {
  return Boolean(url?.includes(STORED_COVER_MARKER));
}

// Copies the cover into storage on demand (or re-fetches it from TikTok when
// the stored link is dead) and redirects to the copy.
export function tiktokCoverProxyUrl(videoUrl: string): string {
  return `/api/media/tiktok-thumb?url=${encodeURIComponent(videoUrl)}`;
}

// TikTok's cover url_list mixes HEIC and JPEG/WEBP variants of the same image
// (often HEIC first) -- <img> tags can't decode HEIC in most browsers and
// neither can sharp, so prefer a JPEG/PNG/WEBP entry when one exists instead
// of always taking url_list[0].
export function pickBrowserImageUrl(urlList: string[] | undefined): string | undefined {
  if (!urlList?.length) return undefined;
  return urlList.find((url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url)) ?? urlList[0];
}
