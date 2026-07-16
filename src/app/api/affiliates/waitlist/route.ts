import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/server/usage";

const BodySchema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  // Duplicate emails are treated as success (idempotent signup) rather than
  // surfaced as an error, so this endpoint never confirms/denies whether an
  // address is already on the list.
  const { error } = await admin
    .from("affiliate_waitlist")
    .upsert({ email: parsed.data.email.toLowerCase(), user_id: user?.id ?? null }, { onConflict: "email", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: "Could not join the waitlist" }, { status: 500 });
  }

  void logActivity({ type: "user", message: "Affiliate waitlist signup", actor: parsed.data.email });

  return NextResponse.json({ ok: true });
}
