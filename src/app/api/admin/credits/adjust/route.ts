import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { InsufficientCreditsError, adjustCreditsAsAdmin } from "@/lib/server/credits";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; delta?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, delta, reason } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (!Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ error: "delta must be a non-zero integer" }, { status: 400 });
  }

  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  try {
    const balance = await adjustCreditsAsAdmin(userId, delta!, reason.trim(), adminEmail);
    return NextResponse.json({ balance });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "That would take the user's balance below zero" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not adjust credits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
