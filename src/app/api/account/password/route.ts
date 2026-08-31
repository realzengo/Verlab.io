import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { checkPasswordStrength, PASSWORD_MAX } from "@/lib/validation";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Brake on brute-forcing the current password, not just noisy retries.
  if (!(await checkRateLimit(`password-change:${user.id}`, 5, 900))) {
    return rateLimitedResponse();
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (currentPassword.length > PASSWORD_MAX || newPassword.length > PASSWORD_MAX) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Whether this account can already sign in with email+password -- an
  // OAuth-only account (e.g. Google) has no "email" identity yet, so it's
  // setting a password for the first time rather than changing one, and has
  // nothing to re-authenticate against.
  const hasPassword = user.identities?.some((identity) => identity.provider === "email") ?? false;

  if (hasPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
    }
    if (!user.email) {
      return serverError("account/password", new Error("password-auth user has no email on record"));
    }

    // Verified against a throwaway, non-persisting client so this never
    // touches the caller's real session cookies -- it only checks the
    // current password is right.
    const verifyClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 }
      );
    }
  }

  const { valid, issues } = checkPasswordStrength(newPassword, user.email);
  if (!valid) {
    return NextResponse.json({ error: issues[0], issues }, { status: 400 });
  }

  // Goes through the session-bound client (not the admin API) so Supabase
  // handles the "first password on an OAuth account" case correctly -- it
  // links the new email/password identity to the account rather than just
  // setting a hash with nothing wired up to authenticate against it.
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return serverError("account/password", updateError);
  }

  // Best-effort: revoke every other session so the change actually locks
  // out anyone else immediately, whether this was routine hygiene or a
  // response to a suspected compromise. Never blocks the response -- the
  // password is already changed at this point either way.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    try {
      const admin = createAdminClient();
      await admin.auth.admin.signOut(session.access_token, "others");
    } catch (signOutError) {
      console.error("[account/password] failed to sign out other sessions:", signOutError);
    }
  }

  return NextResponse.json({ ok: true, hadPassword: hasPassword });
}
