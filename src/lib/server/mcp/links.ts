import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { APP_URL } from "@/lib/constants";

// Public origin the MCP route (and the signed media/thumbnail routes the
// widgets load from) is served on. Production is the one fixed URL every
// connector points at; local dev serves itself so the MCP Inspector can load
// rows that only exist in the dev session.
export const MCP_PUBLIC_ORIGIN = process.env.NODE_ENV === "production" ? "https://verlab.io" : "http://localhost:3000";

// Where widgets and tool results send people for things that only make sense
// in the full app (topping up, the clip editor).
export const APP_LINKS = {
  credits: `${APP_URL}/settings/credits`,
  pricing: `${APP_URL}/settings/subscription`,
  library: `${APP_URL}/library`,
  videoGenerator: `${APP_URL}/video-generator`,
  voiceover: `${APP_URL}/voiceover-generator`,
  bend: `${APP_URL}/bend`,
  clipProject: (projectId: string) => `${APP_URL}/clipping?project=${encodeURIComponent(projectId)}`,
};

// Generated media (images stored as data URIs, voiceovers and videos in
// private Storage buckets) is served to widgets through /api/mcp/media rather
// than raw Supabase signed URLs: a signed URL dies after its TTL, which left
// every older chat with dead players, while these links stay valid and mint a
// fresh short-lived Storage URL on each request. The signature covers what is
// fetched (kind, row id, index) -- presentation flags (download, width) are
// deliberately unsigned since they can't widen access.
export type McpMediaKind = "image" | "voiceover" | "video" | "creator-doc";

const MEDIA_KINDS: readonly McpMediaKind[] = ["image", "voiceover", "video", "creator-doc"];

export function isMcpMediaKind(value: string): value is McpMediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

function secret(): string {
  const value = process.env.MCP_THUMB_PROXY_SECRET;
  if (!value) throw new Error("MCP_THUMB_PROXY_SECRET is not set");
  return value;
}

function signMedia(kind: McpMediaKind, id: string, index: number): string {
  return createHmac("sha256", secret()).update(`media:${kind}:${id}:${index}`).digest("hex").slice(0, 32);
}

export function signMediaUrl(
  kind: McpMediaKind,
  id: string,
  index = 0,
  options: { download?: boolean; width?: number } = {}
): string {
  const params = new URLSearchParams({ k: kind, id, i: String(index), sig: signMedia(kind, id, index) });
  if (options.download) params.set("dl", "1");
  if (options.width) params.set("w", String(options.width));
  return `${MCP_PUBLIC_ORIGIN}/api/mcp/media?${params.toString()}`;
}

export function verifyMediaSignature(kind: McpMediaKind, id: string, index: number, sig: string): boolean {
  const provided = Buffer.from(sig, "hex");
  const wanted = Buffer.from(signMedia(kind, id, index), "hex");
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

/** Parses one of our own signed media links back into what it points at, or null. */
export function parseSignedMediaUrl(raw: string): { kind: McpMediaKind; id: string; index: number } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.origin !== MCP_PUBLIC_ORIGIN || url.pathname !== "/api/mcp/media") return null;
  const kind = url.searchParams.get("k") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const index = Number(url.searchParams.get("i") ?? "0");
  const sig = url.searchParams.get("sig") ?? "";
  if (!isMcpMediaKind(kind) || !id || !Number.isInteger(index) || !verifyMediaSignature(kind, id, index, sig)) return null;
  return { kind, id, index };
}
