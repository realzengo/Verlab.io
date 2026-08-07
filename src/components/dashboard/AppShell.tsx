"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { NicheSidebarProvider } from "@/components/dashboard/NicheSidebarContext";
import { PaywallPricing } from "@/components/dashboard/PaywallPricing";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { McpBackground } from "@/components/mcp/McpBackground";
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
  const pathname = usePathname();

  useEffect(() => {
    if (mobileNavOpen) {
      setShowBackdrop(true);
      return;
    }
    const timeout = setTimeout(() => setShowBackdrop(false), SIDEBAR_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [mobileNavOpen]);
  const isHome = pathname === "/app";
  const isMcp = pathname === "/app/mcp";
  const isImageGenerator = pathname === "/app/image-generator";

  const topBarAndMain = (
    <>
      <TopBar onMenuClick={() => setMobileNavOpen(true)} heading={isPaywalled ? "Pricing" : undefined} isPaywalled={isPaywalled} />
      <main className="flex-1 px-4 pb-8 sm:px-6 sm:pb-12 md:px-8">
        {isPaywalled ? <PaywallPricing hasNeverPaid={hasNeverPaid} /> : children}
      </main>
    </>
  );

  return (
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

        {isHome ? (
          <AuroraBackground className="flex min-w-0 flex-1 flex-col">{topBarAndMain}</AuroraBackground>
        ) : isMcp ? (
          <McpBackground className="flex min-w-0 flex-1 flex-col">{topBarAndMain}</McpBackground>
        ) : isImageGenerator ? (
          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* Plain black background (inherited from bg-app on the parent) --
                just a single soft light near the top, not a full navy-tinted
                Aurora wash, per request to keep this page simple. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[420px] dark:block [mask-image:linear-gradient(to_bottom,black,transparent)] [background-image:radial-gradient(50%_70%_at_50%_0%,rgba(59,130,246,0.22)_0%,rgba(37,99,235,0.07)_45%,transparent_75%)]"
            />
            {topBarAndMain}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">{topBarAndMain}</div>
        )}
      </div>
    </NicheSidebarProvider>
  );
}
