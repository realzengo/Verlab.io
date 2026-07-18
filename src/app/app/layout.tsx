"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { NicheSidebarProvider } from "@/components/dashboard/NicheSidebarContext";
import { AuroraBackground } from "@/components/ui/AuroraBackground";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isHome = usePathname() === "/app";

  const topBarAndMain = (
    <>
      <TopBar onMenuClick={() => setMobileNavOpen(true)} />
      <main className="flex-1 px-4 pb-8 sm:px-6 sm:pb-12 md:px-8">{children}</main>
    </>
  );

  return (
    <NicheSidebarProvider>
      <div className="flex min-h-screen w-full bg-app">
        <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

        {mobileNavOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
        )}

        {isHome ? (
          <AuroraBackground className="flex min-w-0 flex-1 flex-col">{topBarAndMain}</AuroraBackground>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">{topBarAndMain}</div>
        )}
      </div>
    </NicheSidebarProvider>
  );
}
