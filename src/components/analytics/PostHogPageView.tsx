"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";

// App Router client-side navigations don't fire full page loads, so
// posthog-js's own autocapture never sees them -- this fires $pageview
// manually on every route change instead. Needs its own Suspense boundary
// because useSearchParams() opts the tree into client-side rendering.
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !posthog) return;
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (url === previousUrl.current) return;
    previousUrl.current = url;

    posthog.capture("$pageview", { $current_url: `${window.location.origin}${url}` });
  }, [pathname, searchParams, posthog]);

  return null;
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
