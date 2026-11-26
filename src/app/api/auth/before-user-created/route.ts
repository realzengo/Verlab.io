import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { isDisposableEmail } from "disposable-email-domains-js";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { logBlockedAttempt, SIGNUPS_PER_IP_PER_HOUR } from "@/lib/server/abuse-guards";

// Supabase Auth "Before User Created" hook (HTTPS). Supabase calls this for
// every new account -- email/password and Google alike -- before the user
// is created, so a bot can't skip it by calling Supabase directly with the
// public anon key. It blocks:
//   - disposable email domains (disposable-email-domains-js, a maintained list)
//   - more than SIGNUPS_PER_IP_PER_HOUR sign-ups per IP per hour
// and logs every block to public.blocked_attempts.
//
// Set up in the Supabase dashboard: Authentication > Hooks > Before User
// Created > HTTPS, URL https://app.verlab.io/api/auth/before-user-created, and
// copy the generated secret into SUPABASE_AUTH_HOOK_SECRET.
//
// Off switches: SIGNUP_GUARD_DISABLED=1 allows everything, or disable the
// hook in the dashboard.
//
// Supabase gives a hook 5 seconds and blocks the sign-up if it errors, so
// every path here answers quickly with JSON and HTTP 200: an empty object
// allows the sign-up, an `error` object rejects it with that message. (A
// 4xx status would reach the user as a generic 500.) Anything unexpected on
// our side allows the sign-up rather than locking real people out.

interface HookPayload {
  metadata?: { ip_address?: string; name?: string };
  user?: { email?: string; app_metadata?: { provider?: string } };
}

const allow = () => NextResponse.json({});
const reject = (httpCode: number, message: string) => NextResponse.json({ error: { http_code: httpCode, message } });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();

  if (process.env.SIGNUP_GUARD_DISABLED === "1") return allow();

  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    console.error("[signup-guard] SUPABASE_AUTH_HOOK_SECRET is not set; allowing sign-up without checks");
    return allow();
  }

  let payload: HookPayload;
  try {
    // The dashboard shows the secret as "v1,whsec_<base64>"; the library
    // takes the "whsec_<base64>" part.
    payload = new Webhook(secret.replace(/^v1,/, "")).verify(body, Object.fromEntries(request.headers)) as HookPayload;
  } catch (error) {
    // Either a forged call (which can't create a user, so allowing it is
    // harmless) or a misconfigured secret (which must not block every real
    // sign-up). Loud either way, and no checks run.
    console.error("[signup-guard] signature check failed; allowing without checks:", error);
    return allow();
  }

  const email = payload.user?.email?.trim().toLowerCase() ?? "";
  const ip = payload.metadata?.ip_address ?? null;
  const provider = payload.user?.app_metadata?.provider ?? null;

  try {
    if (email && isDisposableEmail(email)) {
      await logBlockedAttempt({ kind: "signup", reason: `disposable_email (${provider ?? "unknown"})`, ip, email });
      return reject(400, "Please sign up with a permanent email address. Temporary or disposable email services aren't accepted.");
    }

    if (ip && !(await checkRateLimit(`signup-ip:${ip}`, SIGNUPS_PER_IP_PER_HOUR, 60 * 60))) {
      await logBlockedAttempt({ kind: "signup", reason: `rate_limited_ip (${provider ?? "unknown"})`, ip, email });
      return reject(429, "Too many sign-ups from your network. Please try again in an hour.");
    }
  } catch (error) {
    console.error("[signup-guard] check failed; allowing:", error);
  }

  return allow();
}
