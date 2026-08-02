// Companion to the byte-light history/list responses from /api/generate-image
// and /api/library -- those intentionally omit full image data (see the
// LIST_SELECT comment in generate-image/route.ts), so a small thumbnail can
// be shown directly via <img src="/api/library/image/{id}/{index}?w=...">,
// but anything that needs the actual bytes (applying an image as a video
// frame, downloading with a specific data-URL-derived filename) has to fetch
// them on demand. This does that fetch and converts the response to a
// base64 data URL the rest of the app already expects.
export async function fetchImageAsDataUrl(id: string, index = 0): Promise<string> {
  const response = await fetch(`/api/library/image/${id}/${index}`);
  if (!response.ok) throw new Error("Could not load that image.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that image."));
    reader.readAsDataURL(blob);
  });
}
