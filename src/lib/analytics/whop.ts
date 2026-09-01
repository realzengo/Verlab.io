// Thin wrapper around the Whop Pixel global (installed in src/app/layout.tsx)
// for conversion-event tracking, plus a sessionStorage handoff for purchase
// value: the price is only known at checkout time, on this domain, but the
// user only lands back here (post Whop-hosted checkout) once the purchase
// has actually gone through -- see CheckoutSyncScreen.tsx.

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

interface PendingPurchase {
  value: number;
  currency: string;
  [key: string]: unknown;
}

const PENDING_PURCHASE_KEY = "whop-pending-purchase";

/** Call right before redirecting to a Whop-hosted checkout URL. */
export function stashPendingPurchase(purchase: PendingPurchase) {
  try {
    sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(purchase));
  } catch {
    // sessionStorage unavailable (private mode) -- the purchase event is
    // just skipped on return; the checkout itself is unaffected.
  }
}

/** Call once, on checkout success, to read and clear the stashed value. */
export function consumePendingPurchase(): PendingPurchase | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PURCHASE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_PURCHASE_KEY);
    return JSON.parse(raw) as PendingPurchase;
  } catch {
    return null;
  }
}
