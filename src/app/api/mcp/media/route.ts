import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMcpMediaKind, verifyMediaSignature } from "@/lib/server/mcp/links";

// Serves generated media to MCP App widgets and to the links tool results
// hand the model (see signMediaUrl in lib/server/mcp/links.ts). There's no
// session on this path -- the HMAC signature over (kind, id, index) is the
// capability, minted only server-side for the row's owner.
//
// Images live as data URLs in image_generations.images and are served
// directly (optionally resized for thumbnails). Voiceovers and videos live in
// private Storage buckets and get a 302 to a fresh short-lived signed URL, so
// a link pasted into a chat weeks ago still plays.

const MAX_THUMB_WIDTH = 1600;
const STORAGE_URL_TTL_SECONDS = 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return new Response("Not found", { status: 404 });
}

function safeFilename(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 80);
  return cleaned || fallback;
}

async function serveImage(id: string, index: number, width: number, download: boolean): Promise<Response> {
  const { data } = await createAdminClient().from("image_generations").select("images").eq("id", id).maybeSingle();
  const images: unknown[] = Array.isArray(data?.images) ? data.images : [];
  const dataUrl = images[index];
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return notFound();

  const comma = dataUrl.indexOf(",");
  let contentType = dataUrl.slice(5, comma).split(";")[0] || "image/png";
  let body = Buffer.from(dataUrl.slice(comma + 1), "base64");

  if (!download && width > 0) {
    try {
      body = Buffer.from(
        await sharp(body).rotate().resize({ width: Math.min(width, MAX_THUMB_WIDTH), withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
      );
      contentType = "image/webp";
    } catch {
      // Undecodable for sharp -- serve the original bytes.
    }
  }

  const extension = contentType.split("/")[1] ?? "png";
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="verlab-image-${index + 1}.${extension}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

async function redirectToStorage(bucket: string, path: string, downloadName: string | null): Promise<Response> {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(path, STORAGE_URL_TTL_SECONDS, downloadName ? { download: downloadName } : undefined);
  if (error || !data?.signedUrl) return notFound();
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "no-store" } });
}

async function serveVoiceover(id: string, index: number, download: boolean): Promise<Response> {
  const { data } = await createAdminClient().from("voiceover_generations").select("title, segments").eq("id", id).maybeSingle();
  const segments: { audioPath?: string }[] = Array.isArray(data?.segments) ? data.segments : [];
  const path = segments[index]?.audioPath;
  if (!path) return notFound();
  const extension = path.split(".").pop() ?? "mp3";
  const name = safeFilename(String(data?.title ?? ""), "Verlab voiceover");
  return redirectToStorage("voiceovers", path, download ? `${name}${segments.length > 1 ? ` part ${index + 1}` : ""}.${extension}` : null);
}

async function serveVideo(id: string, download: boolean): Promise<Response> {
  const { data } = await createAdminClient().from("video_generations").select("output_video_path, status").eq("id", id).maybeSingle();
  if (!data?.output_video_path || data.status !== "completed") return notFound();
  return redirectToStorage("videos", data.output_video_path, download ? `verlab-video-${id.slice(0, 8)}.mp4` : null);
}

async function serveCreatorDoc(id: string): Promise<Response> {
  const { data } = await createAdminClient().from("creator_analyses").select("doc_base64, doc_filename").eq("id", id).maybeSingle();
  if (!data?.doc_base64) return notFound();
  const filename = safeFilename(String(data.doc_filename ?? "").replace(/\.docx$/i, ""), "Creator Analysis");
  return new Response(new Uint8Array(Buffer.from(data.doc_base64, "base64")), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}.docx"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("k") ?? "";
  const id = searchParams.get("id") ?? "";
  const index = Number(searchParams.get("i") ?? "0");
  const sig = searchParams.get("sig") ?? "";

  if (!isMcpMediaKind(kind) || !UUID.test(id) || !Number.isInteger(index) || index < 0 || index > 99 || !/^[0-9a-f]{32}$/.test(sig)) {
    return new Response("Invalid link", { status: 400 });
  }
  if (!verifyMediaSignature(kind, id, index, sig)) return new Response("Invalid signature", { status: 403 });

  const download = searchParams.get("dl") === "1";
  switch (kind) {
    case "image":
      return serveImage(id, index, Number(searchParams.get("w")) || 0, download);
    case "voiceover":
      return serveVoiceover(id, index, download);
    case "video":
      return serveVideo(id, download);
    case "creator-doc":
      return serveCreatorDoc(id);
  }
}
