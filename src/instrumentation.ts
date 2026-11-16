import type { Instrumentation } from "next";

/**
 * Server errors Next.js catches (a thrown error in a page render, route
 * handler, server action or proxy) go to PostHog -> Error tracking. Errors a
 * route catches itself and turns into a JSON 500 never reach this hook.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  try {
    const { PostHog } = await import("posthog-node");
    const client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
    await client.captureExceptionImmediate(err, distinctIdFromCookies(request.headers.cookie, key), {
      digest,
      path: request.path,
      method: request.method,
      route: context.routePath,
      route_type: context.routeType,
      render_source: context.renderSource,
    });
    await client.shutdown();
  } catch (error) {
    console.error("[posthog] couldn't report a server error:", error);
  }
};

/** The visitor's PostHog id from the posthog-js cookie, so the error links to their session. */
function distinctIdFromCookies(header: string | string[] | undefined, key: string): string | undefined {
  const cookies = Array.isArray(header) ? header.join("; ") : header;
  if (!cookies) return undefined;
  const name = `ph_${key}_posthog=`;
  const raw = cookies
    .split(/;\s*/)
    .find((part) => part.startsWith(name))
    ?.slice(name.length);
  if (!raw) return undefined;
  try {
    const id = JSON.parse(decodeURIComponent(raw))?.distinct_id;
    return typeof id === "string" && id ? id : undefined;
  } catch {
    return undefined;
  }
}
