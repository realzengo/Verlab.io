"use client";

import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { railFade } from "@/components/dashboard/SidebarCollapsedContext";

export function SidebarFooter({
  collapsed,
  isAdmin,
  onOpenSearch,
  onNavigate,
}: {
  collapsed: boolean;
  isAdmin: boolean;
  onOpenSearch: () => void;
  onNavigate?: () => void;
}) {
  const fade = railFade(collapsed);

  return (
    <div className="flex flex-col gap-1 border-t border-hairline p-3">
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        title={collapsed ? "Search" : undefined}
        className="font-ui flex h-9 w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-subtle transition-colors hover:text-heading dark:bg-white/[0.03]"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={`flex-1 text-left ${fade}`}>Search</span>
        <kbd
          aria-hidden="true"
          className={`ml-auto hidden shrink-0 rounded border border-hairline bg-app px-1.5 py-px font-sans text-[10px] text-subtle lg:inline-block ${fade}`}
        >
          ⌘K
        </kbd>
      </button>

      {/* Only admins see this; a plain row like the rest of the rail, so the
          one privileged link doesn't outshout every tool above it. */}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label="Admin dashboard"
          title={collapsed ? "Admin" : undefined}
          className="font-ui group flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-[14px] font-medium text-body transition-colors hover:bg-(--app-fill) hover:text-heading"
        >
          <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-subtle group-hover:text-body" aria-hidden="true" />
          <span className={fade}>Admin</span>
        </Link>
      )}
    </div>
  );
}
