"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { NicheSidebarProvider } from "@/components/dashboard/NicheSidebarContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 px-4 pb-8 sm:px-6 sm:pb-12 md:px-8">{children}</main>
        </div>
      </div>
    </NicheSidebarProvider>
  );
}
