import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records one row of request instrumentation behind the admin dashboard's
 * uptime/error-rate tiles and per-endpoint health table. Same rationale as
 * recordUsageEvent (src/lib/server/usage.ts): service-role only, never
 * throws -- a logging failure shouldn't break the calling request.
 */
export async function recordApiRequestLog(entry: {
  endpoint: string;
  method: string;
  status: number;
  durationMs: number;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("api_request_log").insert({
      endpoint: entry.endpoint,
      method: entry.method,
      status: entry.status,
      is_error: entry.status >= 400,
      duration_ms: entry.durationMs,
    });
  } catch (error) {
    console.error(`[api-logging] Failed to record request log for ${entry.endpoint}:`, error);
  }
}

/**
 * Wraps an API route handler with request-level timing/status logging.
 * `endpoint` is a fixed label (e.g. "/api/generate-image") -- not read from
 * the request -- so dynamic segments ([id], [jobId]) don't fragment the
 * per-endpoint health table into one row per id.
 *
 * Only ever reads the returned Response's `status` -- never touches the
 * body, so this is safe to wrap around routes that stream or return binary
 * data (e.g. downloads/file/[id], library/image/[id]/[index]).
 *
 * Logging happens via `after()` (same pattern as generate-image/route.ts),
 * so the DB write happens once the response has already been sent and adds
 * no latency to the caller.
 */
export function withApiLogging<Req extends Request, Args extends unknown[]>(
  endpoint: string,
  handler: (request: Req, ...args: Args) => Promise<Response>
): (request: Req, ...args: Args) => Promise<Response> {
  return async (request: Req, ...args: Args): Promise<Response> => {
    const start = Date.now();
    let status = 500;
    try {
      const response = await handler(request, ...args);
      status = response.status;
      return response;
    } finally {
      const durationMs = Date.now() - start;
      after(() => recordApiRequestLog({ endpoint, method: request.method, status, durationMs }));
    }
  };
}
