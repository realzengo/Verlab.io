"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { createClient } from "@/lib/supabase/client";

// Ties PostHog's distinct_id to the real Supabase user id, on every route
// (marketing + app), so anonymous pre-signup activity and later
// authenticated activity land on one person profile. Resets on sign-out so
// a shared/public machine doesn't keep attributing events to the last user.
export function IdentifyUser() {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && posthog.get_distinct_id() !== user.id) {
        posthog.identify(user.id, { email: user.email });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      } else if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [posthog]);

  return null;
}
