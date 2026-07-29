import { verifyThumbSignature } from "@/lib/server/mcp/thumb-proxy";

// Streams an external video-thumbnail image through Verlab's own origin so
// MCP App widgets (sandboxed iframes with a static `resourceDomains: ["https://verlab.io"]`
// CSP) can display it without allowlisting arbitrary/rotating CDN hosts.
// `sig` ties this to URLs Verlab itself signed server-side (see
// signThumbUrl) -- the `u` param is never trusted on its own.

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 8 * 1024 * 1024;
const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (/^(10\.|192\.168\.|169\.254\.)/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("u");
  const sig = searchParams.get("sig");
  if (!url || !sig || !verifyThumbSignature(url, sig)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }
  if (target.protocol !== "https:" || isBlockedHost(target.hostname)) {
    return new Response("Invalid URL", { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(target, { signal: controller.signal, redirect: "follow" });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new Response("Unsupported content type", { status: 415 });
  }

  const contentLength = Number(upstream.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BYTES) {
    return new Response("Image too large", { status: 413 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
