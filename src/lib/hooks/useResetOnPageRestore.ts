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
 */
export function useResetOnPageRestore(reset: () => void) {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) reset();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [reset]);
}
