import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/server/admin";

// How long a past_due subscriber keeps /app access after their billing
// period ended, before Polar's payment retries are given up on. Matches
// Polar's own dunning window (a handful of retry attempts over a few days).
const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/checkout") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/app")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Deliberately NOT checked for /checkout -- that's the Polar redirect
    // target right after payment, before the webhook has necessarily landed.
    // It polls the DB itself (see /checkout/success) and only hands off into
    // /app once subscription_status/credits actually reflect the payment, so
    // this gate can stay strict without racing the webhook.
    //
    // Also not checked for /app/settings -- a lapsed/past-grace subscriber
    // still needs to reach Subscription/Payment Method to fix their card or
    // resume (see billing/portal route) or view Credit History. Its shared
    // tabbed layout (settings/layout.tsx) links all five tabs together, so
    // this is scoped to the whole settings tree, not just /subscription --
    // otherwise the other tabs would look broken (click -> bounced to
    // /pricing). None of the actual paid tools live under /app/settings.
    if (!isAdminEmail(user.email) && !pathname.startsWith("/app/settings")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_current_period_end")
        .eq("id", user.id)
        .single();

      // past_due gets a grace window past the period it failed to renew --
      // Polar retries the charge a few times before giving up, and a hard
      // cutoff on the very first failed attempt (a card that's since been
      // fixed, a bank hiccup) would lock out someone who's still paying.
      const isWithinPastDueGrace =
        profile?.subscription_status === "past_due" &&
        !!profile.subscription_current_period_end &&
        Date.now() < new Date(profile.subscription_current_period_end).getTime() + PAST_DUE_GRACE_MS;

      const hasActiveSubscription =
        profile?.subscription_status === "active" ||
        profile?.subscription_status === "trialing" ||
        isWithinPastDueGrace;

      if (!hasActiveSubscription) {
        return NextResponse.redirect(new URL("/pricing", request.url));
      }
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/checkout/:path*", "/login", "/signup"],
};
