"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminCommandMenu } from "@/components/admin/AdminCommandMenu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Keeps the backdrop mounted for the sidebar's 200ms slide-out so it fades
// out in sync instead of disappearing the instant the panel starts closing.
const SIDEBAR_TRANSITION_MS = 200;

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [email, setEmail] = useState("");
  const onSearchOpenChange = useCallback((open: boolean) => setSearchOpen(open), []);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

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
    // -- every shared primitive below re-skins off it automatically. One flat
    // page tone; a hairline divides the sidebar from a centered column that
    // holds the page title, the account controls and the page itself.
    <div className="admin-theme flex min-h-screen w-full">
      <AdminSidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />

      {showBackdrop && (
        <div
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
          className={cn(
            "fixed inset-0 z-40 bg-(--admin-overlay) transition-opacity duration-200 ease-in-out md:hidden",
            mobileNavOpen ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10">
          <AdminTopBar onMenuClick={openMobileNav} onOpenSearch={() => setSearchOpen(true)} email={email} />
          <main className="admin-stage pb-16 pt-2">{children}</main>
        </div>
      </div>

      <AdminCommandMenu open={searchOpen} onOpenChange={onSearchOpenChange} />
    </div>
  );
}
