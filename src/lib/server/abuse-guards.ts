import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { CONTACT_EMAIL } from "@/lib/constants";

// Signup and checkout fraud protection. Every check here can be switched
// off with an environment variable, documented next to it and in
// .env.example:
//
//   TURNSTILE_SECRET_KEY       unset -> checkout skips the Turnstile check
//   CHECKOUT_GUARDS_DISABLED=1 -> checkout skips the confirmed-email check
//                                 and the rate limits
//   SIGNUP_GUARD_DISABLED=1    -> the before-user-created hook allows every
//                                 sign-up (see api/auth/before-user-created)

const HOUR = 60 * 60;
export const SIGNUPS_PER_IP_PER_HOUR = 5;
export const CHECKOUTS_PER_HOUR = 5;

/** The visitor's IP. On Vercel the first x-forwarded-for entry is the client. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

export type BlockedAttempt = {
  kind: "signup" | "checkout";
  reason: string;
  ip?: string | null;
  email?: string | null;
  userId?: string | null;
};

/**
 * Records a blocked attempt in public.blocked_attempts (migration
 * 20261126120000_blocked_attempts.sql) and the server log. Never throws:
 * a logging failure must not change whether the request was blocked.
 */
export async function logBlockedAttempt(attempt: BlockedAttempt): Promise<void> {
  console.warn(`[blocked:${attempt.kind}] ${attempt.reason}`, { ip: attempt.ip ?? null, userId: attempt.userId ?? null });
  try {
    const { error } = await createAdminClient().from("blocked_attempts").insert({
      kind: attempt.kind,
      reason: attempt.reason,
      ip: attempt.ip ?? null,
      email: attempt.email ?? null,
      user_id: attempt.userId ?? null,
    });
    if (error) console.error("[blocked] could not record attempt (non-fatal):", error.message);
  } catch (error) {
    console.error("[blocked] could not record attempt (non-fatal):", error);
  }
}

export type TurnstileResult = "passed" | "failed" | "skipped";

/**
 * Checks a Turnstile token with Cloudflare. "skipped" when
 * TURNSTILE_SECRET_KEY isn't set (the check is off). A Cloudflare outage
 * counts as passed, so an outage on their side can't stop real customers
 * from paying -- it's logged.
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return "skipped";
  if (!token) return "failed";
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set("remoteip", ip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error(`[turnstile] siteverify returned ${response.status}; allowing`);
      return "passed";
    }
    const data = (await response.json()) as { success?: boolean };
    return data.success ? "passed" : "failed";
  } catch (error) {
    console.error("[turnstile] siteverify unreachable; allowing:", error);
    return "passed";
  }
}

/**
 * Everything a checkout route checks before creating a checkout. Returns
 * null to proceed, or the response to send back.
 */
export async function guardCheckout({
  request,
  user,
  turnstileToken,
}: {
  request: Request;
  user: { id: string; email?: string | null; email_confirmed_at?: string | null };
  turnstileToken: unknown;
}): Promise<NextResponse | null> {
  const ip = clientIp(request.headers);
  const block = async (reason: string, message: string, status: number) => {
    await logBlockedAttempt({ kind: "checkout", reason, ip, userId: user.id, email: user.email });
    return NextResponse.json({ error: message, code: reason }, { status });
  };

  if (process.env.CHECKOUT_GUARDS_DISABLED !== "1") {
    if (!user.email_confirmed_at) {
      return block(
        "email_not_confirmed",
        "Please confirm your email address before checking out. Check your inbox for the confirmation link.",
        403
      );
    }
    const [userOk, ipOk] = await Promise.all([
      checkRateLimit(`checkout-user:${user.id}`, CHECKOUTS_PER_HOUR, HOUR),
      ip ? checkRateLimit(`checkout-ip:${ip}`, CHECKOUTS_PER_HOUR, HOUR) : Promise.resolve(true),
    ]);
    if (!userOk || !ipOk) {
      return block(
        userOk ? "rate_limited_ip" : "rate_limited_user",
        `Too many checkout attempts. Please wait an hour and try again, or email ${CONTACT_EMAIL} for help.`,
        429
      );
    }
  }

  const captcha = await verifyTurnstile(typeof turnstileToken === "string" ? turnstileToken : null, ip);
  if (captcha === "failed") {
    return block("captcha_failed", "The security check didn't go through. Please refresh the page and try again.", 403);
  }
  return null;
}
