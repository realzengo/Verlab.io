import { NextRequest, NextResponse } from "next/server";
import { advanceWorkingClipProjects } from "@/lib/server/clips/projects";
import { serverError } from "@/lib/server/api-error";

// A sweep can run a moment-finding LLM pass inline (~70s for an hour of
// transcript, longer for 3 hours).
export const maxDuration = 300;

// Same auth pattern as /api/cron/video-poll. Registered in vercel.json.
function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

/**
 * Backstop for /api/webhooks/replicate on clip projects: moves every working
 * project one step, so clips finish with no one on the page even when the
 * webhook is dropped or the create request's after() died, and stale
 * projects get failed and refunded. Every step is a conditional update
 * (projects.ts), so overlapping with the webhook or a page poll is harmless.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const checked = await advanceWorkingClipProjects();
    return NextResponse.json({ checked });
  } catch (error) {
    return serverError("cron/clips-poll", error);
  }
}

// Vercel Cron invokes its paths with GET; POST is for manual triggering.
export const GET = handle;
export const POST = handle;
