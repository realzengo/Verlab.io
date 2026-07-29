"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { NicheSidebarProvider } from "@/components/dashboard/NicheSidebarContext";
import { PaywallModal } from "@/components/dashboard/PaywallModal";
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
}: {
  children: React.ReactNode;
  isPaywalled: boolean;
  hasNeverPaid: boolean;
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

  const topBarAndMain = (
    <>
      <TopBar onMenuClick={() => setMobileNavOpen(true)} />
      <main className="flex-1 px-4 pb-8 sm:px-6 sm:pb-12 md:px-8">{children}</main>
    </>
  );

  return (
    <NicheSidebarProvider>
      {isPaywalled && <PaywallModal hasNeverPaid={hasNeverPaid} />}

      {/* inert (not just pointer-events-none) also pulls this out of the tab
          order and blocks all input while paywalled, matching the modal's
          "the blurred dashboard is the only thing behind it" contract. */}
      <div
        inert={isPaywalled}
        className={cn("flex min-h-screen w-full bg-app", isPaywalled && "pointer-events-none blur-md select-none")}
      >
        <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

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
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">{topBarAndMain}</div>
        )}
      </div>
    </NicheSidebarProvider>
  );
}
