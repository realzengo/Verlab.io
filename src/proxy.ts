import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/server/admin";

// How long a past_due subscriber keeps /app access after their billing
// period ended, before Polar's payment retries are given up on. Matches
// Polar's own dunning window (a handful of retry attempts over a few days).
const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

// A subscription the user has scheduled to cancel (Polar's "canceled" /
// Whop's "canceling") still owes access through the period already paid
// for -- only lapsed once subscription_current_period_end has passed.
const CANCELED_STATUSES = new Set(["canceled", "canceling"]);

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  let pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          pendingCookies = cookiesToSet;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Single place responses get built, so a refreshed session's cookies (set
  // via the Supabase client above) always ride along -- including on
  // redirects, which the previous per-branch NextResponse.redirect() calls
  // would otherwise drop.
  function buildResponse(redirectTo?: URL) {
    const res = redirectTo ? NextResponse.redirect(redirectTo) : NextResponse.next({ request: { headers: requestHeaders } });
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options ?? {}));
    return res;
  }

  if (pathname.startsWith("/checkout") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return buildResponse(loginUrl);
  }

  // The OAuth consent screen (MCP connector auth) just needs a logged-in
  // user -- no subscription/paywall check, same carve-out as /app/settings.
  if (pathname.startsWith("/oauth") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return buildResponse(loginUrl);
  }

  if (pathname.startsWith("/app")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return buildResponse(loginUrl);
    }

    // Not checked for /app/settings -- a lapsed/past-grace subscriber still
    // needs to reach Subscription/Payment Method to fix their card or resume
    // (see billing/portal route) or view Credit History. None of the actual
    // paid tools live under /app/settings.
    if (!isAdminEmail(user.email) && !pathname.startsWith("/app/settings")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_current_period_end, credits")
        .eq("id", user.id)
        .single();

      const periodEndMs = profile?.subscription_current_period_end
        ? new Date(profile.subscription_current_period_end).getTime()
        : null;

      // past_due gets a grace window past the period it failed to renew --
      // Polar retries the charge a few times before giving up, and a hard
      // cutoff on the very first failed attempt (a card that's since been
      // fixed, a bank hiccup) would lock out someone who's still paying.
      const isWithinPastDueGrace =
        profile?.subscription_status === "past_due" && periodEndMs !== null && Date.now() < periodEndMs + PAST_DUE_GRACE_MS;

      // A canceled/canceling subscription keeps access through the period
      // already paid for -- no extra grace beyond that period end (unlike
      // past_due, this isn't a failed charge the provider might still
      // recover, so there's nothing to wait on past what was already paid).
      const isCanceledButStillInPeriod =
        !!profile?.subscription_status &&
        CANCELED_STATUSES.has(profile.subscription_status) &&
        periodEndMs !== null &&
        Date.now() < periodEndMs;

      const hasActiveSubscription =
        profile?.subscription_status === "active" ||
        profile?.subscription_status === "trialing" ||
        isWithinPastDueGrace ||
        isCanceledButStillInPeriod;

      // Any leftover credit balance (subscription credits, a one-time
      // top-up, an admin grant) keeps the dashboard usable on its own,
      // independent of subscription state -- the paywall is about having
      // something to spend, not about the subscription row specifically.
      const hasCredits = (profile?.credits ?? 0) > 0;

      // No redirect: the dashboard itself still renders (blurred, inert,
      // with a paywall modal on top -- see AppShell.tsx) instead of bouncing
      // straight to /pricing. This header is how that server-rendered layout
      // finds out, since middleware and the layout run in separate contexts.
      if (!hasActiveSubscription && !hasCredits) {
        requestHeaders.set("x-paywalled", "1");

        // subscription_status is only ever written by a subscription
        // webhook, so null means this account has never had a subscription
        // of any status -- drives PaywallModal's "never paid" copy vs. the
        // "come back" copy for a lapsed subscriber.
        if (!profile?.subscription_status) {
          requestHeaders.set("x-never-paid", "1");
        }
      }
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return buildResponse(loginUrl);
    }
    if (!isAdminEmail(user.email)) {
      return buildResponse(new URL("/app", request.url));
    }
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    return buildResponse(new URL("/app", request.url));
  }

  return buildResponse();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/checkout/:path*", "/oauth/:path*", "/login", "/signup"],
};
