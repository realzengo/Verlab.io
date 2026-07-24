"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { NicheSidebarProvider } from "@/components/dashboard/NicheSidebarContext";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { McpBackground } from "@/components/mcp/McpBackground";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/app";
  const isMcp = pathname === "/app/mcp";
  const isSettings = pathname.startsWith("/app/settings");

  const topBarAndMain = (
    <>
      <TopBar onMenuClick={() => setMobileNavOpen(true)} />
      <main className="flex-1 px-4 pb-8 sm:px-6 sm:pb-12 md:px-8">{children}</main>
    </>
  );

  return (
    <NicheSidebarProvider>
      <div className={cn("flex min-h-screen w-full", isSettings ? "bg-white" : "bg-app")}>
        <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

        {mobileNavOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
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
