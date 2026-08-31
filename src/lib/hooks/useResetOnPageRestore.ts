import { useEffect } from "react";

/**
 * Redirecting to an external checkout via `window.location.href` never
 * unmounts this page in most browsers -- it gets frozen into the
 * back-forward cache instead. Hitting the browser Back button after
 * checkout then restores the exact in-memory React state from right
 * before the redirect, so a "checking out" flag left `true` (set right
 * before the redirect, with no matching reset since the page was never
 * expected to be seen again) renders as a permanently stuck
 * "Processing..." button. The `pageshow` event's `persisted` flag is the
 * standard signal for this bfcache-restore case -- run `reset` there.
 *
 * `persisted` isn't set reliably everywhere (notably Safari/iOS, and any
 * browser that decides the page isn't bfcache-eligible), so it still left
 * the button stuck for some users. `visibilitychange` back to "visible" is
 * a second, more universal signal for "the user is looking at this tab
 * again" -- if checkout had actually succeeded, the Whop redirect would
 * have done a fresh top-level navigation back with the flag naturally
 * unset, so there's no legitimate case where the tab becomes visible again
 * with a stale in-flight flag still true.
 */
export function useResetOnPageRestore(reset: () => void) {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) reset();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") reset();
    }
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reset]);
}
