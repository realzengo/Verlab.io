import { createHmac, timingSafeEqual } from "node:crypto";

// MCP App widgets run in a sandboxed iframe with a static per-resource CSP
// (`_meta.ui.csp.resourceDomains`), so we can't allowlist the arbitrary,
// rotating TikTok/YouTube/Instagram CDN hosts that video thumbnails actually
// come from. Instead every widget's CSP stays a single, fixed `verlab.io`,
// and thumbnails are proxied through this route. The signature ties the
// proxy to URLs Verlab itself produced server-side -- it is not an open
// proxy for arbitrary client-supplied URLs.

function secret(): string {
  const value = process.env.MCP_THUMB_PROXY_SECRET;
  if (!value) throw new Error("MCP_THUMB_PROXY_SECRET is not set");
  return value;
}

function sign(url: string): string {
  return createHmac("sha256", secret()).update(url).digest("hex").slice(0, 32);
}

// The MCP route is served from one fixed URL for every user (see the
// comment in src/app/api/mcp/route.ts), so the proxy origin is fixed too --
// no need to thread the request origin through every tool handler.
const VERLAB_ORIGIN = "https://verlab.io";

/** Builds a same-origin, signed proxy URL for an external thumbnail image. */
export function signThumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }

  const params = new URLSearchParams({ u: url, sig: sign(url) });
  return `${VERLAB_ORIGIN}/api/mcp/thumb?${params.toString()}`;
}

export function verifyThumbSignature(url: string, sig: string): boolean {
  const expected = sign(url);
  const provided = Buffer.from(sig, "hex");
  const wanted = Buffer.from(expected, "hex");
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}
