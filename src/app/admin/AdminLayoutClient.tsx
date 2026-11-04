"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { cn } from "@/lib/utils";

// Keeps the backdrop mounted for the sidebar's 200ms slide-out so it fades
// out in sync instead of disappearing the instant the panel starts closing.
const SIDEBAR_TRANSITION_MS = 200;

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);

  // The backdrop mounts with the open; only its unmount waits for the slide-out.
  const openMobileNav = () => {
    setShowBackdrop(true);
    setMobileNavOpen(true);
  };

  useEffect(() => {
    if (mobileNavOpen) return;
    const timeout = setTimeout(() => setShowBackdrop(false), SIDEBAR_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [mobileNavOpen]);

  return (
    // `admin-theme` scopes the admin token set (globals.css) to this subtree
    // -- every shared primitive below re-skins off it automatically. White
    // panels on a near-white canvas are the whole figure/ground device; there
    // is no atmospheric decoration behind them.
    <div className="admin-theme flex min-h-screen w-full bg-app">
      <AdminSidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      {showBackdrop && (
        <div
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
          className={cn(
            "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-in-out md:hidden",
            mobileNavOpen ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar onMenuClick={openMobileNav} />
        <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
