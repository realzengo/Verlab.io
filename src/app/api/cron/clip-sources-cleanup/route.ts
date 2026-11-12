import { NextRequest, NextResponse } from "next/server";
import { removeExpiredClipSources } from "@/lib/server/clips/precut";
import { serverError } from "@/lib/server/api-error";

export const maxDuration = 120;

// Same auth pattern as /api/cron/clips-poll. Registered in vercel.json.
function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

/**
 * Removes the clip cuts the server stored for the editor (precut.ts) once
 * they're a week old, so Storage holds only recent projects' sources.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cleaned = await removeExpiredClipSources();
    return NextResponse.json({ cleaned });
  } catch (error) {
    return serverError("cron/clip-sources-cleanup", error);
  }
}

// Vercel Cron invokes its paths with GET; POST is for manual triggering.
export const GET = handle;
export const POST = handle;
