"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { cn } from "@/lib/utils";

// Keeps the backdrop mounted for the sidebar's 200ms slide-out so it fades
// out in sync instead of disappearing the instant the panel starts closing.
const SIDEBAR_TRANSITION_MS = 200;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="flex min-h-screen w-full bg-app">
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
        <AdminTopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-6 pb-12 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
