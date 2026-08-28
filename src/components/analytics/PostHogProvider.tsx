"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Guarded so local/dev/preview environments without a key don't throw --
// posthog-js's capture() calls become silent no-ops when never init()'d.
if (typeof window !== "undefined" && key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    // We fire $pageview ourselves from PostHogPageView (App Router
    // navigations don't trigger the full page loads posthog-js's
    // autocapture listens for).
    capture_pageview: false,
    // Only start a billed person profile once someone is identified
    // (post-signup) -- anonymous marketing-site traffic still shows up in
    // event/session data, just without per-person profile cost.
    person_profiles: "identified_only",
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
