import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Google OAuth exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(`Could not authenticate with Google: ${error.message}`)}`
    );
  }

  // Supabase sends the reason back when it refused the sign-in -- e.g. the
  // sign-up guard hook rejecting a disposable address or too many sign-ups
  // from one network -- so show that instead of a generic message.
  const reason = searchParams.get("error_description")?.slice(0, 300);
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(reason || "Could not authenticate with Google")}`
  );
}
