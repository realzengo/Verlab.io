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

// Every /app /admin /checkout /oauth /login /signup request blocks on this
// file's Supabase calls before anything can render. Without a cap, a slow
// or hung Supabase response (not just an outage -- those already reject
// fast) turns into a navigation that "just stays loading" with no upper
// bound. Timing out and falling back to "no user"/"no profile" bounds the
// worst case instead of leaving the visitor staring at a blank tab.
const SUPABASE_CALL_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// The app (dashboard, admin, auth, checkout, oauth) only lives on
// app.<ROOT_DOMAIN> -- the root domain is the marketing site. Keeping the
// two on separate hosts means a session cookie is never scoped to the
// wrong one (cookies here are host-only; see src/lib/supabase).
const ROOT_DOMAIN = "verlab.io";

// Paths that must stay exactly where they are on app.<ROOT_DOMAIN> instead
// of being treated as a dashboard page -- either real top-level routes
// (auth, admin, checkout, the API) or marketing pages that still need to
// render if someone hits them directly on this host. Everything else is
// rewritten to /app/... below, so the dashboard lives at the bare
// subdomain root (app.verlab.io/library) instead of needing an /app
// prefix in every URL (app.verlab.io/app/library) -- matches how
// app.<product>.com products are normally laid out.
const APP_HOST_PASSTHROUGH_PREFIXES = [
  "/api",
  "/admin",
  "/auth",
  "/checkout",
  "/oauth",
  "/login",
  "/signup",
  "/legal",
  "/pricing",
  "/affiliates",
  "/script-bending",
  "/dev-preview-script-modal",
  "/.well-known",
];

// Paths that belong to "the app" and must never render on the marketing
// root domain -- redirected across to app.verlab.io instead.
const APP_ONLY_PREFIXES = ["/admin", "/checkout", "/oauth", "/login", "/signup", "/app"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Strips an old-style /app prefix down to the clean path it now redirects
// to ("/app" -> "/", "/app/library" -> "/library"). Every dashboard link in
// the app itself already points at the clean form (see src/lib/constants.ts
// and friends) -- this only exists to normalize stale bookmarks/links from
// before the clean-URL rewrite, since usePathname() on the client reflects
// whatever the browser actually navigated to. Without this, landing on
// app.verlab.io/app/mcp directly would render the right page but leave
// every client-side `pathname === "/mcp"` check unmatched (wrong active
// nav item, wrong background, wrong page heading).
function stripAppPrefix(pathname: string) {
  return pathname === "/app" ? "/" : pathname.slice("/app".length);
}

export async function proxy(request: NextRequest) {
  const rawPathname = request.nextUrl.pathname;
  const currentHost = request.nextUrl.hostname;
  const isAppHost = currentHost === `app.${ROOT_DOMAIN}`;
  const isRootDomain = currentHost === ROOT_DOMAIN || currentHost === `www.${ROOT_DOMAIN}`;
  const isOldStyleAppPath = rawPathname === "/app" || rawPathname.startsWith("/app/");

  // Only the two real production hosts get split -- localhost and Vercel
  // preview URLs (which don't have an app.* DNS entry) fall through to the
  // pre-split behavior below, unchanged.
  if (isRootDomain && matchesPrefix(rawPathname, APP_ONLY_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.hostname = `app.${ROOT_DOMAIN}`;
    // Land in one hop on the clean URL instead of redirecting again
    // immediately after crossing hosts.
    if (isOldStyleAppPath) url.pathname = stripAppPrefix(rawPathname);
    return NextResponse.redirect(url, 308);
  }

  // A stale app.verlab.io/app/... link -- normalize to the clean form so
  // every client-side pathname check downstream sees the same URL a fresh
  // clean-URL visit would have produced.
  if (isAppHost && isOldStyleAppPath) {
    const url = request.nextUrl.clone();
    url.pathname = stripAppPrefix(rawPathname);
    return NextResponse.redirect(url, 308);
  }

  // A dot means a static file (favicon.ico, logo.png, ...) -- never a
  // dashboard route, so it's always left alone regardless of host.
  const isStaticFile = rawPathname.includes(".");
  const needsCleanRewrite = isAppHost && !isStaticFile && !matchesPrefix(rawPathname, APP_HOST_PASSTHROUGH_PREFIXES);
  const pathname = needsCleanRewrite ? (rawPathname === "/" ? "/app" : `/app${rawPathname}`) : rawPathname;
  const rewriteUrl = needsCleanRewrite ? (() => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return url;
  })() : null;

  // Everything below is the actual auth/paywall gate, and it's the only
  // part of this file that talks to Supabase -- skip it entirely (no
  // network round trip) for marketing pages, static assets, /api, /auth,
  // etc., on every host, exactly like the narrower matcher this file used
  // to have before the subdomain split needed a broader one to catch
  // clean dashboard URLs.
  const needsAuthCheck =
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/oauth") ||
    pathname === "/login" ||
    pathname === "/signup";

  if (!needsAuthCheck) {
    return rewriteUrl ? NextResponse.rewrite(rewriteUrl) : NextResponse.next();
  }

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

  const mayNeedProfile = pathname.startsWith("/app") && !pathname.startsWith("/app/settings");

  // getSession() decodes the session cookie locally -- no network round trip
  // -- so it can hand us the user id in time to kick the profile lookup off
  // *alongside* getUser()'s network call to the Auth server, instead of
  // waiting for that call to land first. This used to be two sequential
  // round trips on every single /app navigation (the RSC fetch behind every
  // tool click included), which is what made navigating feel like it hung.
  // The profile row is only ever trusted below once getUser() has confirmed
  // the same id, and the query itself stays RLS-scoped to the caller, so a
  // stale/forged cookie can't leak someone else's profile by racing ahead.
  const sessionUserId = mayNeedProfile ? (await supabase.auth.getSession()).data.session?.user.id ?? null : null;

  // A transient network blip talking to Supabase (DNS hiccup, brief outage)
  // must not take the whole app down -- this runs on every /app/admin/
  // checkout/oauth/login/signup request, so an uncaught throw here hangs
  // every navigation until it clears. Treat a failed lookup as "no user";
  // the existing !user branches below already redirect to /login, which is
  // the same safe outcome a real logged-out visitor gets.
  const [userSettled, profileSettled] = await Promise.allSettled([
    withTimeout(supabase.auth.getUser(), SUPABASE_CALL_TIMEOUT_MS),
    sessionUserId
      ? withTimeout(
          supabase
            .from("profiles")
            .select("subscription_status, subscription_current_period_end, credits")
            .eq("id", sessionUserId)
            .single(),
          SUPABASE_CALL_TIMEOUT_MS
        )
      : Promise.resolve(null),
  ]);

  const user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] =
    userSettled.status === "fulfilled" ? userSettled.value.data.user : null;

  // Single place responses get built, so a refreshed session's cookies (set
  // via the Supabase client above) always ride along -- including on
  // redirects, which the previous per-branch NextResponse.redirect() calls
  // would otherwise drop.
  function buildResponse(redirectTo?: URL) {
    const res = redirectTo
      ? NextResponse.redirect(redirectTo)
      : rewriteUrl
        ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
        : NextResponse.next({ request: { headers: requestHeaders } });
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options ?? {}));
    return res;
  }

  if (pathname.startsWith("/checkout") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", rawPathname + request.nextUrl.search);
    return buildResponse(loginUrl);
  }

  // The OAuth consent screen (MCP connector auth) just needs a logged-in
  // user -- no subscription/paywall check, same carve-out as /app/settings.
  if (pathname.startsWith("/oauth") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", rawPathname + request.nextUrl.search);
    return buildResponse(loginUrl);
  }

  if (pathname.startsWith("/app")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      // rawPathname, not the /app-prefixed pathname used for the checks
      // below -- next is handed straight to router.push() after login, so
      // using the clean URL the visitor actually requested keeps the
      // address bar clean post-login too (e.g. "/library", not
      // "/app/library").
      loginUrl.searchParams.set("next", rawPathname);
      return buildResponse(loginUrl);
    }

    const userIsAdmin = isAdminEmail(user.email);

    // Lets the dashboard layout render an Admin link without shipping the
    // allowlist itself to the client -- the /admin gate below (and each
    // admin API route) is still the actual enforcement.
    if (userIsAdmin) {
      requestHeaders.set("x-is-admin", "1");
    }

    // Not checked for /app/settings -- a lapsed/past-grace subscriber still
    // needs to reach Subscription/Payment Method to fix their card or resume
    // (see billing/portal route) or view Credit History. None of the actual
    // paid tools live under /app/settings.
    if (!userIsAdmin && !pathname.startsWith("/app/settings")) {
      // The profile row was already fetched above, in parallel with
      // getUser(), keyed off the session cookie's (unverified) id. Only use
      // it if that id actually matches the now-verified user -- same
      // fallback reasoning as before: a transient Supabase hiccup, a timeout,
      // or an id mismatch all just skip the paywall header below rather than
      // crashing the request. Worst case a lapsed subscriber briefly sees
      // the dashboard instead of the paywall, which is the safe direction
      // to fail in (never lock out someone who's actually paying).
      const profile: { subscription_status: string | null; subscription_current_period_end: string | null; credits: number | null } | null =
        sessionUserId === user.id && profileSettled.status === "fulfilled" && profileSettled.value
          ? profileSettled.value.data
          : null;

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

      // No redirect: the dashboard itself still renders, sidebar and all,
      // with the main content area swapped for an inline pricing view (see
      // AppShell.tsx / PaywallPricing.tsx) instead of bouncing straight to
      // /pricing. This header is how that server-rendered layout finds out,
      // since middleware and the layout run in separate contexts.
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
      loginUrl.searchParams.set("next", rawPathname);
      return buildResponse(loginUrl);
    }
    if (!isAdminEmail(user.email)) {
      return buildResponse(new URL("/", request.url));
    }
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    return buildResponse(new URL("/", request.url));
  }

  return buildResponse();
}

export const config = {
  // Broad on purpose -- app.verlab.io needs every path checked so a clean
  // dashboard URL (e.g. /library) can be rewritten to /app/library.
  // _next internals and favicon are the only blanket exclusions; the cheap
  // needsAuthCheck bailout above keeps everything else (marketing pages,
  // static files, /api, /auth) from paying for the Supabase round trip.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
