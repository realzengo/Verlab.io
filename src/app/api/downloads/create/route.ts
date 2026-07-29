import { NextResponse } from "next/server";

// The downloader product has been retired -- new downloads are disabled here
// while /api/downloads/status, /file, and /preview stay live so users who
// already have files in their history can still reach them.
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: "The video downloader is no longer available" }, { status: 410 });
}
