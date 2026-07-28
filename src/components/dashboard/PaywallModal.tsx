"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sits on top of the blurred, inert dashboard (see AppShell.tsx) for a
 * signed-in user with no active subscription. Deliberately has no close
 * button and no click-outside-to-dismiss -- the blurred content behind it is
 * already non-interactive (inert), so this is the only path forward besides
 * logging out.
 */
export function PaywallModal() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-hairline bg-surface p-8 text-center shadow-card-hover">
        <h2 className="text-xl font-bold text-heading">Verlab is currently paid only</h2>
        <p className="mt-2 text-sm text-body">All features are available with a subscription.</p>

        <button
          type="button"
          onClick={() => router.push("/pricing")}
          className="mt-6 w-full rounded-full bg-btn-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-btn-primary-hover"
        >
          Next
        </button>

        <p className="mt-4 text-sm text-body">
          Need to switch accounts?{" "}
          <button type="button" onClick={handleLogout} className="font-semibold text-primary hover:underline">
            Logout
          </button>
        </p>
      </div>
    </div>
  );
}
