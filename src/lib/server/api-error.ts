import { NextResponse } from "next/server";

/**
 * Logs the real error server-side and returns a generic message to the
 * client -- callers were previously forwarding raw Postgrest/SDK error text
 * (table/column/constraint names) straight into the HTTP response body.
 */
export function serverError(
  context: string,
  error: unknown,
  fallback = "Something went wrong. Please try again."
): NextResponse {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
