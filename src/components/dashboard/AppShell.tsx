"use client";

import { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { NicheSidebarProvider } from "@/components/dashboard/NicheSidebarContext";
import { PaywallPricing } from "@/components/dashboard/PaywallPricing";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { fetcher } from "@/lib/client/fetcher";
import { cn } from "@/lib/utils";

// Keeps the backdrop mounted for the sidebar's 300ms slide-out so it fades
// out in sync instead of disappearing the instant the panel starts closing.
const SIDEBAR_TRANSITION_MS = 300;

export function AppShell({
  children,
  isPaywalled,
  hasNeverPaid,
  isAdmin,
}: {
  children: React.ReactNode;
  isPaywalled: boolean;
  hasNeverPaid: boolean;
  isAdmin: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);

  useEffect(() => {
    if (mobileNavOpen) {
      setShowBackdrop(true);
      return;
    }
    const timeout = setTimeout(() => setShowBackdrop(false), SIDEBAR_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [mobileNavOpen]);

  const topBarAndMain = (
    <>
      <TopBar onMenuClick={() => setMobileNavOpen(true)} heading={isPaywalled ? "Pricing" : undefined} isPaywalled={isPaywalled} />
      <main className="flex-1 px-4 pb-8 sm:px-6 sm:pb-12 md:px-8">
        {isPaywalled ? <PaywallPricing hasNeverPaid={hasNeverPaid} /> : children}
      </main>
    </>
  );

  return (
    // Global SWR cache for the whole /app shell -- keyed by request URL, so
    // navigating between sidebar tabs (Library, Scripts, Transcripts, ...)
    // and back reuses whatever was already fetched instead of every screen
    // re-requesting identical data from scratch on each remount. The cache
    // itself is a module-level singleton (persists for the tab's lifetime
    // regardless of where this provider sits); this just sets the shared
    // fetcher and a dedup window so rapid remounts/StrictMode double-invokes
    // don't double-fire the same request.
    <SWRConfig value={{ fetcher, dedupingInterval: 5000, revalidateOnFocus: true }}>
      <NicheSidebarProvider>
        <div className="flex min-h-screen w-full bg-app">
          <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} isAdmin={isAdmin} />

          {showBackdrop && (
            <div
              aria-hidden="true"
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ease-in-out lg:hidden",
                mobileNavOpen ? "opacity-100" : "opacity-0"
              )}
            />
          )}

          <AuroraBackground className="flex min-w-0 flex-1 flex-col">{topBarAndMain}</AuroraBackground>
        </div>
      </NicheSidebarProvider>
    </SWRConfig>
  );
}
