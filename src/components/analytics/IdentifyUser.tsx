"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { createClient } from "@/lib/supabase/client";
import { trackWhopEvent } from "@/lib/analytics/whop";

type IdentifiableUser = { id: string; email?: string | null; created_at: string; last_sign_in_at?: string | null };

// Supabase sets created_at and last_sign_in_at within milliseconds of each
// other on a brand-new account -- a wider gap means this is a returning
// user's session, not a signup. Padded generously since the two paths that
// land here (OAuth's server-side code exchange, email confirmation's
// client-side link processing) both add their own latency.
const SIGNUP_DETECTION_WINDOW_MS = 60_000;

// Fires the Whop "complete_registration" event exactly once per account,
// however the session was established: immediate-session email/password
// signup and Google OAuth both raise SIGNED_IN client-side (the OAuth
// redirect's session is already set by the time this mounts, so it's caught
// by the initial getUser() call below instead); email-confirmation lands on
// this page with tokens in the URL, which the client SDK turns into a
// SIGNED_IN transition after mount. Covering both triggers, deduped via
// localStorage, catches all three paths without tracking every login too.
function trackSignupIfFresh(user: IdentifiableUser) {
  if (!user.last_sign_in_at) return;
  const gapMs = Math.abs(new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime());
  if (gapMs > SIGNUP_DETECTION_WINDOW_MS) return;

  const dedupeKey = `whop-signup-tracked:${user.id}`;
  try {
    if (localStorage.getItem(dedupeKey)) return;
    localStorage.setItem(dedupeKey, "1");
  } catch {
    // localStorage unavailable -- fire anyway, a rare duplicate beats a lost event.
  }
  trackWhopEvent("complete_registration", { email: user.email ?? undefined, external_id: user.id });
}

// Ties PostHog's distinct_id to the real Supabase user id, on every route
// (marketing + app), so anonymous pre-signup activity and later
// authenticated activity land on one person profile. Resets on sign-out so
// a shared/public machine doesn't keep attributing events to the last user.
export function IdentifyUser() {
  const posthog = usePostHog();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      if (posthog && posthog.get_distinct_id() !== user.id) {
        posthog.identify(user.id, { email: user.email });
      }
      trackSignupIfFresh(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        posthog?.identify(session.user.id, { email: session.user.email });
        trackSignupIfFresh(session.user);
      } else if (event === "SIGNED_OUT") {
        posthog?.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [posthog]);

  return null;
}
