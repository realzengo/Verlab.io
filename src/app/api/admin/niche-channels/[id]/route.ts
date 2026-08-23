import { NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
import { isSafeFreeText } from "@/lib/validation";

const REASONING_MAX = 2000;

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

  // confidence_score and viral_velocity_score are only type-checked above -- a direct API
  // call could otherwise send an out-of-range value like 9999. The UI implies 0-100, so
  // reject out-of-range values outright rather than silently clamping admin-entered data.
  if (body.confidence_score < 0 || body.confidence_score > 100) {
    return NextResponse.json({ error: "confidence_score must be between 0 and 100" }, { status: 400 });
  }
  if (body.viral_velocity_score < 0 || body.viral_velocity_score > 100) {
    return NextResponse.json({ error: "viral_velocity_score must be between 0 and 100" }, { status: 400 });
  }

  if (!isSafeFreeText(body.reasoning, REASONING_MAX)) {
    return NextResponse.json(
      { error: `reasoning must be ${REASONING_MAX} characters or fewer and contain no HTML or control characters` },
      { status: 400 }
    );
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
