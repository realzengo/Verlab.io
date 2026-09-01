// Thin wrapper around the Whop Pixel global (installed in src/app/layout.tsx)
// for conversion-event tracking, plus a signup-in-progress signal used to
// tell a fresh signup apart from a login. Whop already tracks checkout
// views, purchases, subscriptions, and trials on its own hosted checkout
// server-side -- per https://docs.whop.com/developer/ads/pixel, firing a
// client-side "purchase" event for one of those would double-count it in ad
// reporting, so this only ever covers things Whop can't see on its own.

declare global {
  interface Window {
    whop?: {
      track: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

export function trackWhopEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.whop?.track(event, properties);
}

const PENDING_SIGNUP_KEY = "whop-pending-signup";

/**
 * Call right before starting a signup (email submit or OAuth redirect) so
 * IdentifyUser can fire "complete_registration" once the session lands,
 * however it gets there. sessionStorage survives a full-page OAuth
 * round-trip (same tab, same origin) but not a confirmation link opened in
 * a different tab/browser -- that path is covered separately by a
 * `?signup=1` query param on the redirect URL instead.
 */
export function markPendingSignup() {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_KEY, "1");
  } catch {
    // sessionStorage unavailable -- that signup just won't get tracked.
  }
}

/**
 * Consumes (clears) either signup signal: the sessionStorage flag set by
 * markPendingSignup, or a `?signup=1` param on the current URL (stripped in
 * place via replaceState so a refresh doesn't re-trigger it). Synchronous
 * and idempotent, so it's safe to call from multiple listeners racing on
 * the same auth event -- only the first call ever finds the signal.
 */
export function consumeSignupSignal(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_SIGNUP_KEY)) {
      sessionStorage.removeItem(PENDING_SIGNUP_KEY);
      return true;
    }
  } catch {
    // ignore
  }

  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("signup") !== "1") return false;
  url.searchParams.delete("signup");
  window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
  return true;
}
