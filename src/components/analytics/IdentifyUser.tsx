"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { createClient } from "@/lib/supabase/client";
import { consumeSignupSignal, trackWhopEvent } from "@/lib/analytics/whop";

type IdentifiableUser = { id: string; email?: string | null };

// Fires the Whop "complete_registration" event exactly once per signup,
// however the session was established. Relies on an explicit signal set by
// the signup page (markPendingSignup / a `?signup=1` redirect param) rather
// than inferring "is this new?" from Supabase's timestamps -- covers
// immediate-session email/password signup and Google OAuth (session already
// set by the time this mounts, caught by the initial getUser() call below)
// and email-confirmation links (land here via a SIGNED_IN transition after
// mount, caught by the listener instead). consumeSignupSignal() clears the
// signal on read, so this is safe to call from both triggers.
function trackSignupIfMarked(user: IdentifiableUser) {
  if (!consumeSignupSignal()) return;
  // event_id: one account can only register once, so its own id is a
  // natural dedupe key -- per Whop's docs, this collapses a retry or a
  // stray double-fire into a single counted event instead of two.
  trackWhopEvent("complete_registration", { email: user.email ?? undefined, external_id: user.id, event_id: user.id });
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
      trackSignupIfMarked(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        posthog?.identify(session.user.id, { email: session.user.email });
        trackSignupIfMarked(session.user);
      } else if (event === "SIGNED_OUT") {
        posthog?.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [posthog]);

  return null;
}
