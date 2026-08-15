import { NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const FACELESS_CATEGORIES = [
  "2D Animation",
  "3D Animation",
  "Whiteboard",
  "Stock Footage",
  "AI Pictures",
  "Screen Recording",
  "Documentary",
];
const COMPLEXITY_LEVELS = ["EASY", "MEDIUM", "HARD", "LEGENDARY"];

// Persists an admin's approval (or override) of a previewed classification
// from POST /api/admin/niche-channels/[id]/classify -- the body is the
// classification fields as the admin wants them stored (untouched for a
// plain approve, edited for an override), never re-derived server-side.
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    is_faceless?: boolean;
    confidence_score?: number;
    faceless_category?: string;
    complexity?: string;
    viral_velocity_score?: number;
    reasoning?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.is_faceless !== "boolean" ||
    typeof body.confidence_score !== "number" ||
    !FACELESS_CATEGORIES.includes(body.faceless_category ?? "") ||
    !COMPLEXITY_LEVELS.includes(body.complexity ?? "") ||
    typeof body.viral_velocity_score !== "number" ||
    typeof body.reasoning !== "string"
  ) {
    return NextResponse.json({ error: "A complete classification object is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("niche_channels")
    .update({
      is_faceless: body.is_faceless,
      faceless_confidence: body.confidence_score,
      faceless_category: body.faceless_category,
      complexity: body.complexity,
      viral_velocity_score: body.viral_velocity_score,
      classification_reasoning: body.reasoning,
      verified_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return serverError("admin/niche-channels/[id] PATCH", error);
  }

  return NextResponse.json({ ok: true });
}
